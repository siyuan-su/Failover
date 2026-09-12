import { useEffect, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import "./App.css";

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
    <main>
      <h1>Failover</h1>

      <p>
        Design, simulate, and test resilient cloud architectures.
      </p>

      <h2>Your Architectures</h2>

      <div className="create-section">
        <input
          type="text"
          placeholder="Architecture name"
          value={newArchitectureName}
          onChange={(event) =>
            setNewArchitectureName(event.target.value)
          }
        />

        <button onClick={createArchitecture}>
          Create Architecture
        </button>
      </div>

      <ul>
        {architectures.map((architecture, index) => (
          <li key={architecture.id}>
            <div>
              <span>Architecture {index + 1}: </span>

              <Link to={`/architecture/${architecture.id}`}>
                <strong>{architecture.name}</strong>
              </Link>

              <span> — {architecture.status}</span>
            </div>

            <button onClick={() => deleteArchitecture(architecture.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function ArchitecturePage() {
  const { id } = useParams();

  const [architecture, setArchitecture] =
    useState<Architecture | null>(null);

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
  }, [id]);

  if (!architecture) {
    return <p>Loading...</p>;
  }

  return (
    <main>
      <Link to="/">← Back</Link>

      <h1>{architecture.name}</h1>

      <p>This will become the visual architecture editor.</p>
    </main>
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