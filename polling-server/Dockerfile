# Stage 1: Build the Go code
FROM golang:alpine AS builder

WORKDIR /app

# Copy Go mod and sum files
COPY go.mod go.sum ./

# Download Go dependencies
RUN go mod download

# Copy the source code
COPY . .

ENV GIN_MODE=release

# Build the Go executable
RUN CGO_ENABLED=0 GOOS=linux go build -o app .

# Stage 2: Copy the executable to a lightweight container
FROM alpine:latest

WORKDIR /app

# Copy the executable from the builder stage
COPY --from=builder /app/app .

# Set the executable permissions
RUN chmod +x ./app

# Run the executable
CMD ["./app"]
