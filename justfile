root := justfile_directory()

# Start Qdrant container
qdrant: qdrant-dirs
    container run -d \
      --name qdrant \
      --platform linux/arm64 \
      --cpus 4 \
      --memory 4G \
      -p 127.0.0.1:6333:6333 \
      -p 127.0.0.1:6334:6334 \
      -v "{{root}}/qdrant_data:/qdrant/storage" \
      -v "{{root}}/qdrant_config/production.yaml:/qdrant/config/production.yaml" \
      qdrant/qdrant:latest

# Stop Qdrant container
qdrant-stop:
    container stop qdrant

# Restart Qdrant container
qdrant-restart: qdrant-stop qdrant

# View Qdrant logs
qdrant-logs:
    container logs -f qdrant

# Create required directories
qdrant-dirs:
    mkdir -p "{{root}}/qdrant_data" "{{root}}/qdrant_config"
