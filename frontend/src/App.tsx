import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ControlButton,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
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

function ArchitectureEditor() {
  const { id } = useParams();

  const [fullscreenCanvas, setFullscreenCanvas] =
    useState(false);

  const [architecture, setArchitecture] =
    useState<Architecture | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { screenToFlowPosition } = useReactFlow();

  const [locked, setLocked] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult | null>(null);

  const [deployedNodeId, setDeployedNodeId] =
    useState<string | null>(null);

  const [deploying, setDeploying] =
    useState(false);

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

async function deployLocally(nodeId: string) {
  console.log("1. Deploy clicked:", nodeId);

  setDeployedNodeId(nodeId);
  setDeploying(true);
  setDeploymentResult(null);

  try {
    console.log("2. Saving editor");

    await saveEditor();

    console.log("3. Editor saved");

    const response = await fetch(
      `http://localhost:5000/api/architectures/${id}/deploy-local`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nodeId,
        }),
      }
    );

    console.log("4. Backend responded:", response.status);

    const data = await response.json();

    console.log("5. Deployment result:", data);

    if (!response.ok) {
      setDeploymentResult({
        error: data.error || "Local deployment failed",
      });

      return;
    }

    setDeploymentResult(data);

    console.log("6. Deployment state updated");
  } catch (error) {
    console.error("DEPLOY ERROR:", error);

    setDeploymentResult({
      error: "Could not deploy component",
    });
  } finally {
    setDeploying(false);
  }
}

  async function previewRuntime() {
    const response = await fetch(
      `http://localhost:5000/api/architectures/${id}/runtime-spec`
    );

    if (!response.ok) {
      console.error("Failed to build runtime specification");
      return;
    }

    const data = await response.json();

    console.log("Runtime specification:", data);
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
      addEdge(connection, currentEdges)
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

  function deleteComponent(nodeId: string) {
    setNodes((currentNodes) =>
      currentNodes.filter((node) => node.id !== nodeId)
    );

    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          edge.source !== nodeId &&
          edge.target !== nodeId
      )
    );

    setSelectedNodeId(null);
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

      deploying:
        deploying &&
        selectedNodeId === node.id,

      deployment:
        deployedNodeId === node.id
          ? deploymentResult
          : null,
    },
  }));

  if (!architecture) {
    return <p>Loading...</p>;
  }

    return (
    <div className="editor-page">
      <aside className="sidebar">
        <Link to="/">← Back</Link>

        <h2>{architecture.name}</h2>

        <button onClick={saveEditor}>
          Save Architecture
        </button>

        <button onClick={previewRuntime}>
          Preview Runtime
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          deleteKeyCode={
            locked ? null : ["Backspace", "Delete"]
          }
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
          }}
          onNodesDelete={() => {
            setSelectedNodeId(null);
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