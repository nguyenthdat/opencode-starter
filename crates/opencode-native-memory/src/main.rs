use std::io::{self, BufRead, BufReader, BufWriter, Write};
use std::panic::{AssertUnwindSafe, catch_unwind};

use anyhow::{Context, Result, anyhow};
use opencode_native_memory::{
    DeleteRequest, DoctorRequest, FeedbackRequest, ForgetRequest, GetRequest, ListRequest,
    MemoryConfig, MemoryEngine, PurgeRequest, SearchRequest, StoreRequest, SyncSharedRequest,
    UpdateRequest,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const MAX_REQUEST_BYTES: usize = 1_048_576;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RpcRequest {
    id: u64,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct RpcResponse {
    id: u64,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl RpcResponse {
    fn success(id: u64, result: Value) -> Self {
        Self {
            id,
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    fn failure(id: u64, error: impl Into<String>) -> Self {
        Self {
            id,
            ok: false,
            result: None,
            error: Some(error.into()),
        }
    }
}

struct Service {
    config: MemoryConfig,
    engine: Option<MemoryEngine>,
}

impl Service {
    fn new(config: MemoryConfig) -> Self {
        Self {
            config,
            engine: None,
        }
    }

    fn engine(&mut self) -> Result<&mut MemoryEngine> {
        if self.engine.is_none() {
            self.engine = Some(MemoryEngine::open(self.config.clone())?);
        }
        self.engine
            .as_mut()
            .ok_or_else(|| anyhow!("native memory engine did not initialize"))
    }

    fn handle(&mut self, request: RpcRequest) -> Result<(RpcResponse, bool)> {
        let id = request.id;
        let result = match request.method.as_str() {
            "search" => {
                let params = serde_json::from_value::<SearchRequest>(request.params)?;
                serde_json::to_value(self.engine()?.search(&params)?)?
            }
            "store" => serde_json::to_value(self.engine()?.store(serde_json::from_value::<
                StoreRequest,
            >(
                request.params
            )?)?)?,
            "get" => {
                let params = serde_json::from_value::<GetRequest>(request.params)?;
                serde_json::to_value(self.engine()?.get(&params)?)?
            }
            "list" => {
                let params = serde_json::from_value::<ListRequest>(request.params)?;
                serde_json::to_value(self.engine()?.list(&params)?)?
            }
            "update" => serde_json::to_value(self.engine()?.update(serde_json::from_value::<
                UpdateRequest,
            >(
                request.params
            )?)?)?,
            "delete" => {
                let params = serde_json::from_value::<DeleteRequest>(request.params)?;
                serde_json::to_value(self.engine()?.delete(&params)?)?
            }
            "forget" => {
                let params = serde_json::from_value::<ForgetRequest>(request.params)?;
                serde_json::to_value(self.engine()?.forget(&params)?)?
            }
            "purge" => {
                let params = serde_json::from_value::<PurgeRequest>(request.params)?;
                serde_json::to_value(self.engine()?.purge(&params)?)?
            }
            "feedback" => {
                let params = serde_json::from_value::<FeedbackRequest>(request.params)?;
                serde_json::to_value(self.engine()?.feedback(&params)?)?
            }
            "sync_shared" => {
                serde_json::to_value(self.engine()?.sync_shared(serde_json::from_value::<
                    SyncSharedRequest,
                >(
                    request.params
                )?)?)?
            }
            "status" => serde_json::to_value(self.engine()?.status()?)?,
            "optimize" => serde_json::to_value(self.engine()?.optimize()?)?,
            "doctor" => {
                let params = serde_json::from_value::<DoctorRequest>(request.params)?;
                serde_json::to_value(self.engine()?.doctor(&params)?)?
            }
            "shutdown" => return Ok((RpcResponse::success(id, json!({ "stopped": true })), true)),
            method => return Err(anyhow!("unknown native memory method: {method}")),
        };
        Ok((RpcResponse::success(id, result), false))
    }
}

fn main() -> Result<()> {
    let config = MemoryConfig::discover()?;
    match std::env::args().nth(1).as_deref() {
        Some("--doctor") => {
            let engine = MemoryEngine::open(config)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&engine.doctor(&DoctorRequest { deep: true })?)?
            );
            Ok(())
        }
        Some("--warmup") => {
            let engine = MemoryEngine::open(config)?;
            println!("{}", serde_json::to_string_pretty(&engine.status()?)?);
            Ok(())
        }
        Some(argument) => Err(anyhow!("unknown argument: {argument}")),
        None => run_protocol(config),
    }
}

fn run_protocol(config: MemoryConfig) -> Result<()> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut input = BufReader::new(stdin.lock());
    let mut output = BufWriter::new(stdout.lock());
    let mut service = Service::new(config);
    let mut buffer = Vec::new();

    loop {
        buffer.clear();
        let bytes = input.read_until(b'\n', &mut buffer)?;
        if bytes == 0 {
            break;
        }
        if buffer.len() > MAX_REQUEST_BYTES {
            write_response(
                &mut output,
                &RpcResponse::failure(0, format!("request exceeds {MAX_REQUEST_BYTES} bytes")),
            )?;
            continue;
        }

        let request = match serde_json::from_slice::<RpcRequest>(&buffer) {
            Ok(request) => request,
            Err(error) => {
                write_response(
                    &mut output,
                    &RpcResponse::failure(0, format!("invalid request JSON: {error}")),
                )?;
                continue;
            }
        };
        let request_id = request.id;
        let handled = catch_unwind(AssertUnwindSafe(|| service.handle(request)));
        let (response, shutdown) = match handled {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => (
                RpcResponse::failure(request_id, format!("{error:#}")),
                false,
            ),
            Err(_) => (
                RpcResponse::failure(request_id, "native memory operation panicked"),
                false,
            ),
        };
        write_response(&mut output, &response)?;
        if shutdown {
            break;
        }
    }
    Ok(())
}

fn write_response(output: &mut impl Write, response: &RpcResponse) -> Result<()> {
    serde_json::to_writer(&mut *output, response)
        .context("cannot encode native memory response")?;
    output.write_all(b"\n")?;
    output.flush()?;
    Ok(())
}
