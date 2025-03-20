# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.21-alpine AS backend-builder
WORKDIR /app
COPY go.* ./
COPY migrations/ ./migrations/
COPY main.sevalla.go ./main.go
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o server

# Stage 3: Final stage
FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates

# Copy the built React app
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Copy the Go binary
COPY --from=backend-builder /app/server .

# Create directory for PocketBase data
RUN mkdir -p pb_data

# Expose the port
EXPOSE 8090

# Set environment variables
ENV PORT=8090

# Run the server
CMD ["./server"] 