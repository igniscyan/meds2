# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy only necessary files
COPY go.mod go.sum ./
COPY migrations/ ./migrations/
COPY main.sevalla.go ./main.go

# Download dependencies
RUN go mod download

# Build with CGO disabled and for Linux
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -tags netgo -ldflags '-extldflags "-static"' -o server

# Stage 3: Final stage
FROM alpine:latest
WORKDIR /app

# Add CA certificates for HTTPS
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