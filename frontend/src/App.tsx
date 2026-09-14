import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ControlButton,
  ConnectionMode,
  ConnectionLineType,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import "./App.css";
import CloudNode from "./components/CloudNode";

const nodeTypes = {
  cloudNode: CloudNode,
};

type Architecture = {
  id: number;
  name: string;
  status: string;
};

function Dashboard() {
  const [architectures, setArchitectures] = useState<Architecture[]>([]);
  const [newArchitectureName, setNewArchitectureName] = useState("");

  async function loadArchitectures() {
    const response = await fetch(
      "http://localhost:5000/api/architectures"
    );

    const data = await response.json();

    setArchitectures(data);
  }

  async function createArchitecture() {
    if (newArchitectureName.trim() === "") {
      return;
    }

    const response = await fetch(
      "http://localhost:5000/api/architectures",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newArchitectureName,
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to create architecture");
      return;
    }

    const newArchitecture = await response.json();

    setArchitectures([...architectures, newArchitecture]);
    setNewArchitectureName("");
  }

  async function deleteArchitecture(id: number) {
    const response = await fetch(
      `http://localhost:5000/api/architectures/${id}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      console.error("Failed to delete architecture");
      return;
    }

    setArchitectures(
      architectures.filter(
        (architecture) => architecture.id !== id
      )
    );
  }

  useEffect(() => {
    loadArchitectures();
  }, []);

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div>
          <h1>Failover</h1>
          <p>
            Design, simulate, and test resilient cloud architectures.
          </p>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="create-card">
          <div>
            <h2>Create a new architecture</h2>
            <p>
              Start building a distributed system and test how it handles failures.
            </p>
          </div>

          <form
            className="create-row"
            onSubmit={(event) => {
              event.preventDefault();
              createArchitecture();
            }}
          >
            <input
              type="text"
              placeholder="Architecture name"
              value={newArchitectureName}
              onChange={(event) =>
                setNewArchitectureName(event.target.value)
              }
            />

            <button type="submit">
              Create Architecture
            </button>
          </form>
        </section>

        <section className="architectures-section">
          <div className="section-header">
            <h2>Your Architectures</h2>
            <span>{architectures.length} total</span>
          </div>

          <div className="architecture-grid">
            {architectures.map((architecture, index) => (
              <div className="architecture-card" key={architecture.id}>
                <div className="architecture-card-top">
                  <span className="architecture-number">
                    Architecture {index + 1}
                  </span>

                  <span className="status-badge">
                    {architecture.status}
                  </span>
                </div>

                <Link
                  className="architecture-link"
                  to={`/architecture/${architecture.id}`}
                >
                  {architecture.name}
                </Link>

                <div className="architecture-actions">
                  <Link
                    className="open-button"
                    to={`/architecture/${architecture.id}`}
                  >
                    Open
                  </Link>

                  <button
                    className="delete-button"
                    onClick={() =>
                      deleteArchitecture(architecture.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

type DeploymentResult = {
  error?: string;

  deployment?: {
    nodeId: string;
    containerName: string;
    serviceName: string;
    hostPort: number;
    status: string;

    health?: {
      service: string;
      status: string;
      capacity: number;
      timestamp: string;
    };
  };
};

type ArchitectureDeployment = {
  architectureId: number;
  networkName: string;
  status: string;

  deployments: {
    nodeId: string;
    type: string;
    serviceName: string;
    containerName?: string;
    hostPort?: number;
    status: string;
    error?: string;
  }[];
};

type RuntimeService = {
  id: string;
  name: string;
  type: string;
  provider: string;
  region: string;
  capacity: number;
  status: string;
};

type RuntimeConnection = {
  source: string;
  target: string;
};

type RuntimePreview = {
  architectureId: number;
  services: RuntimeService[];
  connections: RuntimeConnection[];
};

type RuntimeStatus = {
  nodeId: string;
  componentType: string;
  containerName: string;
  dockerStatus: string;
  status: string;

  health?: {
    status?: string;

    dependencies?: {
      mysql?: {
        status: string;
        error?: string;
      };

      redis?: {
        status: string;
        error?: string;
      };
    };
  };
};

function ArchitectureEditor() {
  const { id } = useParams();

  const [fullscreenCanvas, setFullscreenCanvas] =
    useState(false);

  const [architecture, setArchitecture] =
    useState<Architecture | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const {
    screenToFlowPosition,
    deleteElements,
  } = useReactFlow();

  const [locked, setLocked] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult | null>(null);

  const [deployedNodeId, setDeployedNodeId] =
    useState<string | null>(null);

  const [deploying, setDeploying] =
    useState(false);

  const [
    architectureDeployment,
    setArchitectureDeployment,
  ] =
    useState<ArchitectureDeployment | null>(
      null
    );

  const [
    deployingArchitecture,
    setDeployingArchitecture,
  ] = useState(false);

  const [runtimePreview, setRuntimePreview] =
  useState<RuntimePreview | null>(null);

  const [showRuntimePreview, setShowRuntimePreview] =
    useState(false);

  const [loadingRuntimePreview, setLoadingRuntimePreview] =
    useState(false);

  const [
    runtimeStatuses,
    setRuntimeStatuses,
  ] = useState<RuntimeStatus[]>([]);

  const [recoveringNodeIds, setRecoveringNodeIds] =
    useState<Set<string>>(new Set());

  const runtimeRequestId =
    useRef(0);

  useEffect(() => {
    async function loadArchitecture() {
      const response = await fetch(
        `http://localhost:5000/api/architectures/${id}`
      );

      if (!response.ok) {
        console.error("Failed to load architecture");
        return;
      }

      const data = await response.json();

      setArchitecture(data);
    }

    loadArchitecture();
    loadEditor();
  }, [id]);

  useEffect(() => {
    if (!architectureDeployment) {
      return;
    }

    let cancelled = false;

    let timeoutId:
      ReturnType<typeof setTimeout>;

    async function pollRuntime() {
      if (cancelled) {
        return;
      }

      await loadRuntimeStatus();

      if (!cancelled) {
        timeoutId = setTimeout(
          pollRuntime,
          500
        );
      }
    }

    pollRuntime();

    return () => {
      cancelled = true;

      clearTimeout(timeoutId);
    };
  }, [
    architectureDeployment,
    id,
    recoveringNodeIds,
  ]);

  function getRuntimeService(
    serviceId: string
  ) {
    return runtimePreview?.services.find(
      (service) => service.id === serviceId
    );
  }

  function getDockerImage(type: string) {
    switch (type) {
      case "api-server":
        return "failover-api-server";

      case "mysql":
        return "mysql:8.4";

      case "redis":
        return "redis:7-alpine";

      case "load-balancer":
        return "Not implemented yet";

      case "worker":
        return "Not implemented yet";

      default:
        return "Unsupported";
    }
  }

  async function restartRuntimeService(
    nodeId: string
  ) {
    // Immediately show Recovering.
    setRecoveringNodeIds((current) => {
      const next = new Set(current);

      next.add(nodeId);

      return next;
    });

    setRuntimeStatuses((current) =>
      current.map((runtime) =>
        runtime.nodeId === nodeId
          ? {
              ...runtime,
              dockerStatus: "starting",
              status: "Recovering",
            }
          : runtime
      )
    );

    try {
      const response = await fetch(
        `http://localhost:5000/api/architectures/${id}/runtime/${nodeId}/restart`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to recover service"
        );
      }

      // Keep checking until Docker reports the
      // recovered service as healthy.
      for (
        let attempt = 0;
        attempt < 20;
        attempt++
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 400)
        );

        const statusResponse = await fetch(
          `http://localhost:5000/api/architectures/${id}/runtime-status`
        );

        if (!statusResponse.ok) {
          continue;
        }

        const data =
          await statusResponse.json();

        const recoveredService =
          data.services.find(
            (service: RuntimeStatus) =>
              service.nodeId === nodeId
          );

        if (
          recoveredService?.status ===
          "Healthy"
        ) {
          // Recovery is genuinely complete.
          setRecoveringNodeIds(
            (current) => {
              const next =
                new Set(current);

              next.delete(nodeId);

              return next;
            }
          );

          setRuntimeStatuses(
            data.services
          );

          return;
        }
      }

      // Container started, but didn't become
      // healthy within our recovery window.
      setRecoveringNodeIds((current) => {
        const next = new Set(current);

        next.delete(nodeId);

        return next;
      });

      await loadRuntimeStatus();
    } catch (error) {
      console.error(
        "Service recovery failed:",
        error
      );

      setRecoveringNodeIds((current) => {
        const next = new Set(current);

        next.delete(nodeId);

        return next;
      });

      await loadRuntimeStatus();
    }
  }

  async function stopRuntimeService(
    nodeId: string
  ) {
    // Immediately show failure in the UI.
    setRuntimeStatuses((current) =>
      current.map((runtime) =>
        runtime.nodeId === nodeId
          ? {
              ...runtime,
              dockerStatus: "exited",
              status: "Failed",
            }
          : runtime
      )
    );

    try {
      await fetch(
        `http://localhost:5000/api/architectures/${id}/runtime/${nodeId}/stop`,
        {
          method: "POST",
        }
      );

      await loadRuntimeStatus();

      // Check again shortly afterward so dependency
      // degradation appears quickly.
      await loadRuntimeStatus();

    } catch (error) {
      console.error(
        "Failure simulation failed:",
        error
      );

      await loadRuntimeStatus();
    }
  }

  async function loadRuntimeStatus() {
    const requestId =
      ++runtimeRequestId.current;

    try {
      const response = await fetch(
        `http://localhost:5000/api/architectures/${id}/runtime-status`
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      // If a newer request started while this one
      // was running, ignore this old response.
      if (
        requestId !==
        runtimeRequestId.current
      ) {
        return;
      }

      setRuntimeStatuses(
        data.services.map(
          (service: RuntimeStatus) => {
            if (
              recoveringNodeIds.has(
                service.nodeId
              )
            ) {
              return {
                ...service,
                status: "Recovering",
              };
            }

            return service;
          }
        )
      );
    } catch (error) {
      console.error(
        "Failed to load runtime status:",
        error
      );
    }
  }

  async function deployLocally(nodeId: string) {
    setDeployedNodeId(nodeId);
    setDeploying(true);
    setDeploymentResult(null);

    try {
      await saveEditor();

      const response = await fetch(
        `http://localhost:5000/api/architectures/${id}/deploy-local-all`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Local deployment failed"
        );
      }

      const nodeDeployment =
        data.deployments.find(
          (deployment: {
            nodeId: string;
          }) =>
            deployment.nodeId === nodeId
        );

      if (!nodeDeployment) {
        throw new Error(
          "Deployment result not found for component"
        );
      }

      setDeploymentResult({
        deployment: {
          nodeId: nodeDeployment.nodeId,
          containerName:
            nodeDeployment.containerName,
          serviceName:
            nodeDeployment.serviceName,
          hostPort:
            nodeDeployment.hostPort,
          status:
            nodeDeployment.status,

          health:
            nodeDeployment.health,
        },
      });

      setArchitectureDeployment(data);
    } catch (error) {
      console.error(
        "Local deployment failed:",
        error
      );

      setDeploymentResult({
        error:
          error instanceof Error
            ? error.message
            : "Could not deploy component",
      });
    } finally {
      setDeploying(false);
    }
  }

  async function deployArchitectureLocally() {
    setDeployingArchitecture(true);
    setArchitectureDeployment(null);

    try {
      await saveEditor();

      const response = await fetch(
        `http://localhost:5000/api/architectures/${id}/deploy-local-all`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Architecture deployment failed"
        );
      }

      setArchitectureDeployment(data);

      console.log(
        "Architecture deployed:",
        data
      );
    } catch (error) {
      console.error(
        "Architecture deployment failed:",
        error
      );
    } finally {
      setDeployingArchitecture(false);
    }
  }

  function previewRuntime() {
    setLoadingRuntimePreview(true);

    try {
      const services: RuntimeService[] =
        nodes.map((node) => ({
          id: node.id,

          name:
            String(node.data.label) ||
            String(node.data.componentType),

          type:
            node.data.componentType === "API Server"
              ? "api-server"
              : node.data.componentType === "MySQL Database"
                ? "mysql"
                : node.data.componentType === "Redis Cache"
                  ? "redis"
                  : node.data.componentType === "Load Balancer"
                    ? "load-balancer"
                    : node.data.componentType === "Worker"
                      ? "worker"
                      : "unknown",

          provider:
            String(node.data.provider || "AWS"),

          region:
            String(node.data.region || "us-east-1"),

          capacity:
            Number(node.data.capacity || 500),

          status:
            String(node.data.status || "Healthy"),
        }));

      const connections: RuntimeConnection[] =
        edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
        }));

      setRuntimePreview({
        architectureId: Number(id),
        services,
        connections,
      });

      setShowRuntimePreview(true);
    } catch (error) {
      console.error(
        "Failed to preview runtime:",
        error
      );
    } finally {
      setLoadingRuntimePreview(false);
    }
  }

  async function loadEditor() {
    const response = await fetch(
      `http://localhost:5000/api/architectures/${id}/editor`
    );

    if (!response.ok) {
      console.error("Failed to load editor");
      return;
    }

    const data = await response.json();

    setNodes(data.nodes);
    setEdges(data.edges);
  }

  async function saveEditor() {
    const response = await fetch(
      `http://localhost:5000/api/architectures/${id}/editor`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          nodes,
          edges,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        "Failed to save architecture"
      );
    }

    console.log("Architecture saved");
  }

  function onConnect(connection: Connection) {
    setEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          type: "step",
        },
        currentEdges
      )
    );
  }

  function onDragStart(
    event: React.DragEvent<HTMLButtonElement>,
    componentType: string
  ) {
    if (locked) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData(
      "application/reactflow",
      componentType
    );

    event.dataTransfer.effectAllowed = "move";
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (locked) {
      return;
    }

    const componentType = event.dataTransfer.getData(
      "application/reactflow"
    );

    if (!componentType) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode: Node = {
      id: crypto.randomUUID(),
      type: "cloudNode",
      position,

      data: {
        label: componentType,
        componentType,

        provider: "AWS",
        region: "us-east-1",
        capacity: 500,
        status: "Healthy",
      },
    };

    setNodes((currentNodes) => [
      ...currentNodes,
      newNode,
    ]);
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async function deleteComponent(nodeId: string) {
    await deleteElements({
      nodes: [{ id: nodeId }],
    });

    setSelectedNodeId(null);

    if (deployedNodeId === nodeId) {
      setDeployedNodeId(null);
      setDeploymentResult(null);
    }
  }

  function updateNode(
    nodeId: string,
    field: string,
    value: string | number
  ) {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        let updatedData = {
          ...node.data,
          [field]: value,
        };

        if (field === "provider") {
          updatedData = {
            ...updatedData,

            region:
              value === "AWS"
                ? "us-east-1"
                : "canada-central",
          };
        }

        return {
          ...node,
          data: updatedData,
        };
      })
    );
  }

  const displayNodes = nodes.map((node) => ({
    ...node,

    data: {
      ...node.data,

      onUpdate: updateNode,
      onDelete: deleteComponent,
      onDeploy: deployLocally,

      runtimeStatus:
        runtimeStatuses.find(
          (runtime) =>
            runtime.nodeId === node.id
        ) || null,

      onStopRuntime:
        stopRuntimeService,

      onRestartRuntime:
        restartRuntimeService,

      deploying:
        deploying &&
        selectedNodeId === node.id,

      deployment:
        deployedNodeId === node.id
          ? deploymentResult
          : null,

      runtimeDeployment:
        architectureDeployment?.deployments.find(
          (deployment) =>
            deployment.nodeId === node.id
        ) || null,
    },
  }));

  if (!architecture) {
    return <p>Loading...</p>;
  }

  function getRuntimeDependencyConnections() {
    if (!runtimePreview) {
      return [];
    }

    return runtimePreview.connections.filter(
      (connection) => {
        const source =
          getRuntimeService(
            connection.source
          );

        const target =
          getRuntimeService(
            connection.target
          );

        if (!source || !target) {
          return false;
        }

        const sourceIsApi =
          source.type === "api-server";

        const targetIsApi =
          target.type === "api-server";

        const sourceIsDependency =
          source.type === "mysql" ||
          source.type === "redis";

        const targetIsDependency =
          target.type === "mysql" ||
          target.type === "redis";

        return (
          (sourceIsApi &&
            targetIsDependency) ||
          (targetIsApi &&
            sourceIsDependency)
        );
      }
    );
  }

    return (
    <div className="editor-page">
      <aside className="sidebar">
        <Link to="/">← Back</Link>

        <h2>{architecture.name}</h2>

        <button onClick={saveEditor}>
          Save Architecture
        </button>

        <button
          onClick={previewRuntime}
          disabled={loadingRuntimePreview}
        >
          {loadingRuntimePreview
            ? "Building Preview..."
            : "Preview Runtime"}
        </button>

        <button
          className="deploy-architecture-button"
          onClick={deployArchitectureLocally}
          disabled={deployingArchitecture}
        >
          {deployingArchitecture
            ? "Starting & Checking Services..."
            : "Deploy Architecture Locally"}
        </button>

        <p>Components</p>

        <button
          draggable={!locked}
          onDragStart={(event) =>
            onDragStart(event, "Load Balancer")
          }
        >
          Load Balancer
        </button>

        <button
          draggable={!locked}
          onDragStart={(event) =>
            onDragStart(event, "API Server")
          }
        >
          API Server
        </button>

        <button
          draggable={!locked}
          onDragStart={(event) =>
            onDragStart(event, "MySQL Database")
          }
        >
          MySQL Database
        </button>

        <button
          draggable={!locked}
          onDragStart={(event) =>
            onDragStart(event, "Redis Cache")
          }
        >
          Redis Cache
        </button>

        <button
          draggable={!locked}
          onDragStart={(event) =>
            onDragStart(event, "Worker")
          }
        >
          Worker
        </button>
      </aside>

      <div
        className={
          fullscreenCanvas
            ? "flow-container flow-container-fullscreen"
            : "flow-container"
        }
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.Step}
          
          isValidConnection={(connection) =>
            connection.source !== connection.target
          }
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          deleteKeyCode={
            locked ? null : ["Backspace", "Delete"]
          }
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
          }}
          onNodesDelete={(deletedNodes) => {
            const deletedIds = new Set(
              deletedNodes.map((node) => node.id)
            );

            setEdges((currentEdges) =>
              currentEdges.filter(
                (edge) =>
                  !deletedIds.has(edge.source) &&
                  !deletedIds.has(edge.target)
              )
            );

            setSelectedNodeId(null);

            if (
              deployedNodeId &&
              deletedIds.has(deployedNodeId)
            ) {
              setDeployedNodeId(null);
              setDeploymentResult(null);
            }
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
          }}
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          elementsSelectable={!locked}
          panOnDrag={!locked}
          zoomOnScroll={!locked}
          zoomOnPinch={!locked}
          proOptions={{
            hideAttribution: true,
          }}
          defaultViewport={{
            x: 0,
            y: 0,
            zoom: 1,
          }}
          defaultEdgeOptions={{
            type: "step",

            style: {
              stroke: "#94a3b8",
              strokeWidth: 2,
            },
          }}
        >
          <Background
            gap={22}
            size={1.4}
          />

          <Controls
            showInteractive={false}
            showFitView={false}
          >
            <ControlButton
              onClick={() =>
                setFullscreenCanvas(
                  (current) => !current
                )
              }
              title={
                fullscreenCanvas
                  ? "Exit canvas fullscreen"
                  : "Canvas fullscreen"
              }
            >
              {fullscreenCanvas ? "↙" : "⛶"}
            </ControlButton>

            <ControlButton
              onClick={() =>
                setLocked(
                  (current) => !current
                )
              }
              title={
                locked
                  ? "Unlock canvas"
                  : "Lock canvas"
              }
            >
              {locked ? "🔒" : "🔓"}
            </ControlButton>
          </Controls>
                </ReactFlow>
      </div>
          {showRuntimePreview && runtimePreview && (
            <div
              className="runtime-preview-overlay"
              onMouseDown={() =>
                setShowRuntimePreview(false)
              }
            >
              <div
                className="runtime-preview-modal"
                onMouseDown={(event) =>
                  event.stopPropagation()
                }
              >
                {/* HEADER */}
                <div className="runtime-preview-header">
                  <div>
                    <span className="runtime-preview-eyebrow">
                      Runtime Preview
                    </span>

                    <h2>{architecture.name}</h2>

                    <p>
                      See what Failover will create before
                      deploying your architecture.
                    </p>
                  </div>

                  <button
                    className="runtime-preview-close"
                    onClick={() =>
                      setShowRuntimePreview(false)
                    }
                  >
                    ×
                  </button>
                </div>

                {/* SUMMARY */}
                <div className="runtime-preview-summary">
                  <div className="runtime-summary-item">
                    <span>Target</span>
                    <strong>Local Docker</strong>
                  </div>

                  <div className="runtime-summary-item">
                    <span>Services</span>
                    <strong>
                      {runtimePreview.services.length}
                    </strong>
                  </div>

                  <div className="runtime-summary-item">
                    <span>Connections</span>
                    <strong>
                      {runtimePreview.connections.length}
                    </strong>
                  </div>

                  <div className="runtime-summary-item">
                    <span>Network</span>
                    <strong>
                      failover-{runtimePreview.architectureId}-network
                    </strong>
                  </div>
                </div>

                <div className="runtime-preview-content">
                  {/* SERVICES */}
                  <section className="runtime-preview-section">
                    <div className="runtime-section-title">
                      <h3>Services</h3>

                      <p>
                        Components that will become runtime
                        services.
                      </p>
                    </div>

                    <div className="runtime-service-grid">
                      {runtimePreview.services.map(
                        (service) => (
                          <div
                            className="runtime-service-card"
                            key={service.id}
                          >
                            <div className="runtime-service-heading">
                              <div>
                                <strong>
                                  {service.name}
                                </strong>

                                <span>
                                  {service.type}
                                </span>
                              </div>

                              <span className="runtime-ready-badge">
                                Ready
                              </span>
                            </div>

                            <div className="runtime-service-divider" />

                            <div className="runtime-service-details">
                              <div>
                                <span>Provider</span>
                                <strong>
                                  {service.provider}
                                </strong>
                              </div>

                              <div>
                                <span>Region</span>
                                <strong>
                                  {service.region}
                                </strong>
                              </div>

                              <div>
                                <span>Capacity</span>
                                <strong>
                                  {service.capacity}
                                </strong>
                              </div>

                              <div>
                                <span>Docker Image</span>

                                <code>
                                  {getDockerImage(
                                    service.type
                                  )}
                                </code>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </section>

                  {/* LOWER GRID */}
                  <div className="runtime-lower-grid">
                    {/* CONNECTIONS */}
                    <section className="runtime-preview-section runtime-panel">
                      <div className="runtime-section-title">
                        <h3>Connections</h3>

                        <p>
                          Service topology defined by your diagram.
                        </p>
                      </div>

                      {runtimePreview.connections.length ===
                      0 ? (
                        <div className="runtime-empty">
                          No component connections.
                        </div>
                      ) : (
                        <div className="runtime-connection-list">
                          {runtimePreview.connections.map(
                            (connection, index) => {
                              const source =
                                getRuntimeService(
                                  connection.source
                                );

                              const target =
                                getRuntimeService(
                                  connection.target
                                );

                              return (
                                <div
                                  className="runtime-connection"
                                  key={`${connection.source}-${connection.target}-${index}`}
                                >
                                  <strong>
                                    {source?.name ||
                                      "Unknown"}
                                  </strong>

                                  <span>→</span>

                                  <strong>
                                    {target?.name ||
                                      "Unknown"}
                                  </strong>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </section>

                    {/* DOCKER PLAN */}
                    <section className="runtime-preview-section runtime-panel">
                      <div className="runtime-section-title">
                        <h3>Docker Plan</h3>

                        <p>
                          Containers Failover will create
                          locally.
                        </p>
                      </div>

                      <div className="runtime-docker-plan">
                        <div className="runtime-plan-row">
                          <strong>
                            Docker Network
                          </strong>

                          <code>
                            failover-
                            {runtimePreview.architectureId}
                            -network
                          </code>
                        </div>

                        {runtimePreview.services.map(
                          (service) => (
                            <div
                              className="runtime-plan-row"
                              key={service.id}
                            >
                              <strong>
                                {service.name}
                              </strong>

                              <span>→</span>

                              <code>
                                {getDockerImage(
                                  service.type
                                )}
                              </code>
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  </div>

                  {/* VALIDATION */}
                  <section className="runtime-preview-section runtime-validation-panel">
                    <div className="runtime-section-title">
                      <h3>Validation</h3>

                      <p>
                        Checks before local deployment.
                      </p>
                    </div>

                    <div className="runtime-validation-grid">
                      <div className="validation-success">
                        <span>✓</span>

                        <div>
                          <strong>
                            {
                              runtimePreview.services
                                .length
                            }{" "}
                            services found
                          </strong>

                          <p>
                            Runtime services detected.
                          </p>
                        </div>
                      </div>

                      <div className="validation-success">
                        <span>✓</span>

                        <div>
                          <strong>
                            Docker network will be created
                          </strong>

                          <p>
                            failover-
                            {
                              runtimePreview.architectureId
                            }
                            -network
                          </p>
                        </div>
                      </div>

                      <div className="validation-success">
                        <span>✓</span>

                        <div>
                          <strong>
                            {getRuntimeDependencyConnections().length}{" "}
                            runtime dependencies
                          </strong>

                          <p>
                            API database/cache dependencies configured.
                          </p>
                        </div>
                      </div>

                      <div className="validation-warning">
                        <span>!</span>

                        <div>
                          <strong>
                            Cloud provider metadata
                          </strong>

                          <p>
                            AWS/Azure settings are metadata
                            in Local Docker mode.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* FOOTER */}
                <div className="runtime-preview-footer">
                  <button
                    className="runtime-cancel-button"
                    onClick={() =>
                      setShowRuntimePreview(false)
                    }
                  >
                    Close
                  </button>

                  <button
                    className="runtime-deploy-button"
                    disabled={deployingArchitecture}
                    onClick={async () => {
                      await deployArchitectureLocally();

                      setShowRuntimePreview(false);
                    }}
                  >
                    {deployingArchitecture
                      ? "Starting Services..."
                      : "Deploy Architecture Locally"}
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}

function ArchitecturePage() {
  return (
    <ReactFlowProvider>
      <ArchitectureEditor />
    </ReactFlowProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route
        path="/architecture/:id"
        element={<ArchitecturePage />}
      />
    </Routes>
  );
}

export default App;