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

## Screenshots

<img width="1919" height="1067" alt="image" src="https://github.com/user-attachments/assets/bee03139-e05f-45ed-af70-62446d55c05e" />
<img width="1919" height="1067" alt="image" src="https://github.com/user-attachments/assets/2cbe7397-a000-4374-ad54-227a89512f58" />
<img width="1919" height="1072" alt="image" src="https://github.com/user-attachments/assets/3e561485-b203-4dab-85f2-262bf8933e1b" />
<img width="1919" height="1066" alt="image" src="https://github.com/user-attachments/assets/7756e071-ea7e-4bac-859e-97aa6d08549e" />
<img width="1850" height="1038" alt="image" src="https://github.com/user-attachments/assets/88d01ccc-c9f9-43ac-912a-42a803cb099a" />
<img width="927" height="734" alt="image" src="https://github.com/user-attachments/assets/04f347b7-d4c4-4b84-820d-b7e7acc9c09a" />

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
