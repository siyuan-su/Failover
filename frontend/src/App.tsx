import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  addEdge,
  useEdgesState,
  useNodesState,
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

function ArchitecturePage() {
  const { id } = useParams();

  const [architecture, setArchitecture] =
    useState<Architecture | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [locked, setLocked] = useState(false);

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
      console.error("Failed to save architecture");
      return;
    }

    console.log("Architecture saved");
  }

  function onConnect(connection: Connection) {
    setEdges((currentEdges) =>
      addEdge(connection, currentEdges)
    );
  }

  function addNode(componentType: string) {
    const newNode: Node = {
      id: crypto.randomUUID(),

      type: "cloudNode",

      position: {
        x: 100 + nodes.length * 40,
        y: 100 + nodes.length * 40,
      },

      data: {
        label: componentType,
        componentType: componentType,
      },
    };

    setNodes((currentNodes) => [
      ...currentNodes,
      newNode,
    ]);
  }

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

        <p>Components</p>

        <button onClick={() => addNode("Load Balancer")}>
          + Load Balancer
        </button>

        <button onClick={() => addNode("API Server")}>
          + API Server
        </button>

        <button onClick={() => addNode("MySQL Database")}>
          + MySQL Database
        </button>

        <button onClick={() => addNode("Redis Cache")}>
          + Redis Cache
        </button>

        <button onClick={() => addNode("Worker")}>
          + Worker
        </button>
      </aside>

      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
          >
            <ControlButton
              onClick={() => setLocked((current) => !current)}
              title={locked ? "Unlock canvas" : "Lock canvas"}
            >
              {locked ? "🔒" : "🔓"}
            </ControlButton>
          </Controls>
        </ReactFlow>
      </div>
    </div>
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