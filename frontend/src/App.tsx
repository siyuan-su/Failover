import { useState } from "react";
import "./App.css";

type Architecture = {
  id: number;
  name: string;
  status: string;
};

function App() {
  const [architectures, setArchitectures] = useState<Architecture[]>([
    {
      id: 1,
      name: "Black Friday Architecture",
      status: "Ready",
    },
    {
      id: 2,
      name: "Multi-Region Failover Test",
      status: "Ready",
    },
  ]);

  const [newArchitectureName, setNewArchitectureName] = useState("");

  function createArchitecture() {
    if (newArchitectureName.trim() === "") {
      return;
    }

    const newArchitecture: Architecture = {
      id: Date.now(),
      name: newArchitectureName,
      status: "Ready",
    };

    setArchitectures([...architectures, newArchitecture]);
    setNewArchitectureName("");
  }

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
          onChange={(event) => setNewArchitectureName(event.target.value)}
        />

        <button onClick={createArchitecture}>
          Create Architecture
        </button>
      </div>

      <ul>
        {architectures.map((architecture) => (
          <li key={architecture.id}>
            <strong>{architecture.name}</strong>
            <span> — {architecture.status}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;