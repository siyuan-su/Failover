# Failover

Failover is a full-stack multi-cloud architecture designer for building,
simulating, and deploying resilient distributed systems.

Users can visually construct cloud architectures using components such as
API servers, load balancers, MySQL databases, and Redis caches, connect
service dependencies, simulate failures locally with Docker, and monitor
how failures propagate through the system.

Each service can also be configured independently for AWS or Azure,
allowing a single architecture to deploy services across multiple cloud
providers.

## Features

### Visual Architecture Designer
- Drag-and-drop architecture editor built with React Flow
- API Server, Load Balancer, MySQL, Redis, and Worker components
- Configurable service provider, region, capacity, and status
- Visual service connections and dependency relationships
- Architecture persistence using MySQL

### Local Distributed-System Simulation
- Converts architecture components into Docker containers
- Creates isolated Docker networks for each architecture
- Automatically configures service dependencies
- Real-time health monitoring
- Service failure and recovery controls
- Runtime event history
- Dependency-aware degradation

### Load Balancing & Failover
- Health-aware load balancing across API replicas
- Automatic removal of unhealthy backends
- Round-robin routing between healthy API servers
- Degraded and failed states based on backend availability
- Interactive traffic-routing tests

### Multi-Cloud Deployment
Each component can independently specify its cloud provider and region.

Failover currently supports container deployment to:

- AWS
  - Amazon ECR for container images
  - Amazon ECS with Fargate for container execution

- Azure
  - Azure Container Registry (ACR) for container images
  - Azure Container Instances (ACI) for container execution

This allows a single architecture to contain services deployed across
both AWS and Azure.

Example:

Payment API 1 → Azure → North Central US
Payment API 2 → AWS   → us-east-1

## Architecture

Frontend
    ↓
React + TypeScript + React Flow
    ↓
Node.js / Express Backend
    ↓
MySQL
    ↓
Deployment Engine
    ├── Local → Docker
    ├── AWS   → ECR → ECS Fargate
    └── Azure → ACR → Azure Container Instances

## Tech Stack

**Frontend**
- React
- TypeScript
- React Flow
- Vite

**Backend**
- Node.js
- Express
- MySQL

**Infrastructure**
- Docker
- AWS ECR
- AWS ECS / Fargate
- Azure Container Registry
- Azure Container Instances

## How It Works

1. Create an architecture.
2. Drag cloud components onto the architecture canvas.
3. Connect components to define dependencies.
4. Configure each component's provider, region, and capacity.
5. Preview the generated runtime architecture.
6. Run the architecture locally using Docker or deploy supported
   services to the cloud.
7. Simulate service failures and recoveries.
8. Observe health changes, dependency degradation, load-balancer
   failover, and runtime events.

## Example Failure Scenario

Consider an architecture with two replicated API servers behind a load
balancer.

Healthy:

Load Balancer
├── Payment API 1 ✓
└── Payment API 2 ✓

After Payment API 1 fails:

Load Balancer (Degraded)
├── Payment API 1 ✗
└── Payment API 2 ✓

Traffic is automatically routed to the remaining healthy API server.

If both API servers fail, the load balancer transitions to a Failed
state.

Recovering an API server restores routing and updates the architecture's
runtime health.

## Project Goals

Failover was built to explore how distributed systems behave during
service failures while combining software engineering, containerization,
cloud infrastructure, and system reliability concepts in a single
interactive application.

The project demonstrates concepts including:

- Service health checks
- Failure detection and recovery
- Dependency propagation
- Load balancing
- Container orchestration
- Distributed-system resilience
- Multi-cloud deployment
- Infrastructure automation

## Future Improvements

- Deploy databases and caches as managed cloud resources
- Cloud-native load balancer provisioning
- Cross-cloud networking
- Automatic infrastructure cleanup
- Infrastructure-as-Code generation
- Additional cloud providers and component types