import { tool } from "@opencode-ai/plugin";
import {
  assertHttpUrl,
  pushFlag,
  pushOption,
  runCli,
  validateJsonObject,
} from "@opencode-config/plugin-kit";

const schema = tool.schema;

const outputFormat = schema
  .enum(["json", "markdown"])
  .default("json")
  .describe("CLI output format.");
const browserMode = schema
  .enum(["auto", "always", "never"])
  .default("auto")
  .describe("When to use headless browser fallback.");

const INSTALL_HINT =
  "crawlberg was not found. Install it with `brew install xberg-io/tap/crawlberg`, or use `bunx @xberg-io/crawlberg-cli` / `uvx --from crawlberg-cli crawlberg`.";

function executeCrawlberg(args, context) {
  return runCli({
    command: "crawlberg",
    args,
    context,
    timeoutMs: 900_000,
    installHint: INSTALL_HINT,
  });
}

function pushSharedCrawlOptions(cliArgs, args) {
  pushOption(cliArgs, "--format", args.format);
  pushOption(cliArgs, "--timeout", args.timeout);
  pushOption(cliArgs, "--browser-mode", args.browser_mode);
  pushOption(cliArgs, "--browser-endpoint", args.browser_endpoint);
  pushOption(cliArgs, "--user-agent", args.user_agent);
  pushOption(cliArgs, "--proxy", args.proxy);
  pushFlag(cliArgs, "--respect-robots-txt", args.respect_robots_txt);
  pushOption(cliArgs, "--config", args.config);
}

export const CrawlbergPlugin = async () => ({
  tool: {
    crawlberg_scrape: tool({
      description: "Scrape one URL to JSON or Markdown with the crawlberg CLI.",
      args: {
        url: schema.string().url().describe("URL to scrape."),
        format: outputFormat,
        timeout: schema
          .number()
          .int()
          .positive()
          .max(600000)
          .default(30000)
          .describe("Request timeout in ms."),
        browser_mode: browserMode,
        browser_endpoint: schema
          .string()
          .url()
          .optional()
          .describe("Optional CDP WebSocket endpoint."),
        user_agent: schema
          .string()
          .min(1)
          .optional()
          .describe("Optional HTTP user agent."),
        proxy: schema.string().url().optional().describe("Optional proxy URL."),
        respect_robots_txt: schema
          .boolean()
          .default(false)
          .describe("Respect robots.txt."),
        config: schema
          .string()
          .min(2)
          .optional()
          .describe("Optional CrawlConfig JSON."),
      },
      async execute(args, context) {
        validateJsonObject(args.config, "config");

        const cliArgs = ["scrape", assertHttpUrl(args.url)];
        pushSharedCrawlOptions(cliArgs, args);
        return executeCrawlberg(cliArgs, context);
      },
    }),
    crawlberg_crawl: tool({
      description:
        "Crawl one or more seed URLs to JSON or Markdown with the crawlberg CLI.",
      args: {
        urls: schema
          .array(schema.string().url())
          .min(1)
          .max(20)
          .describe("Seed URLs to crawl."),
        depth: schema
          .number()
          .int()
          .min(0)
          .max(20)
          .default(2)
          .describe("Maximum crawl depth."),
        max_pages: schema
          .number()
          .int()
          .positive()
          .max(10000)
          .optional()
          .describe("Maximum pages to crawl."),
        concurrent: schema
          .number()
          .int()
          .positive()
          .max(64)
          .default(10)
          .describe("Maximum concurrent requests."),
        rate_limit: schema
          .number()
          .int()
          .min(0)
          .default(200)
          .describe("Delay between requests in ms."),
        stay_on_domain: schema
          .boolean()
          .default(false)
          .describe("Restrict crawling to the seed domain."),
        format: outputFormat,
        timeout: schema
          .number()
          .int()
          .positive()
          .max(600000)
          .default(30000)
          .describe("Request timeout in ms."),
        browser_mode: browserMode,
        browser_endpoint: schema
          .string()
          .url()
          .optional()
          .describe("Optional CDP WebSocket endpoint."),
        user_agent: schema
          .string()
          .min(1)
          .optional()
          .describe("Optional HTTP user agent."),
        proxy: schema.string().url().optional().describe("Optional proxy URL."),
        respect_robots_txt: schema
          .boolean()
          .default(false)
          .describe("Respect robots.txt."),
        config: schema
          .string()
          .min(2)
          .optional()
          .describe("Optional CrawlConfig JSON."),
      },
      async execute(args, context) {
        validateJsonObject(args.config, "config");

        const cliArgs = [
          "crawl",
          ...args.urls.map((url) => assertHttpUrl(url, "urls[]")),
          "--depth",
          String(args.depth),
          "--concurrent",
          String(args.concurrent),
        ];
        pushOption(cliArgs, "--max-pages", args.max_pages);
        pushOption(cliArgs, "--rate-limit", args.rate_limit);
        pushFlag(cliArgs, "--stay-on-domain", args.stay_on_domain);
        pushSharedCrawlOptions(cliArgs, args);
        return executeCrawlberg(cliArgs, context);
      },
    }),
    crawlberg_map: tool({
      description:
        "Enumerate URLs from sitemaps and link extraction with the crawlberg CLI.",
      args: {
        url: schema.string().url().describe("URL to map."),
        limit: schema
          .number()
          .int()
          .positive()
          .max(10000)
          .optional()
          .describe("Maximum URLs to return."),
        search: schema
          .string()
          .min(1)
          .optional()
          .describe("Filter URLs by substring."),
        format: outputFormat,
        timeout: schema
          .number()
          .int()
          .positive()
          .max(600000)
          .default(30000)
          .describe("Request timeout in ms."),
        browser_mode: browserMode,
        browser_endpoint: schema
          .string()
          .url()
          .optional()
          .describe("Optional CDP WebSocket endpoint."),
        respect_robots_txt: schema
          .boolean()
          .default(false)
          .describe("Respect robots.txt."),
        config: schema
          .string()
          .min(2)
          .optional()
          .describe("Optional CrawlConfig JSON."),
      },
      async execute(args, context) {
        validateJsonObject(args.config, "config");

        const cliArgs = ["map", assertHttpUrl(args.url)];
        pushOption(cliArgs, "--limit", args.limit);
        pushOption(cliArgs, "--search", args.search);
        pushOption(cliArgs, "--format", args.format);
        pushOption(cliArgs, "--timeout", args.timeout);
        pushOption(cliArgs, "--browser-mode", args.browser_mode);
        pushOption(cliArgs, "--browser-endpoint", args.browser_endpoint);
        pushFlag(cliArgs, "--respect-robots-txt", args.respect_robots_txt);
        pushOption(cliArgs, "--config", args.config);
        return executeCrawlberg(cliArgs, context);
      },
    }),
  },
});

export default CrawlbergPlugin;
