import { useEffect, useState } from "react";
import "./App.css";

type Architecture = {
  id: number;
  name: string;
  status: string;
};

function App() {
  const [architectures, setArchitectures] = useState<Architecture[]>([]);
  const [newArchitectureName, setNewArchitectureName] = useState("");

  async function loadArchitectures() {
    const response = await fetch("http://localhost:5000/api/architectures");
    const data = await response.json();

    setArchitectures(data);
  }

  async function createArchitecture() {
    if (newArchitectureName.trim() === "") {
      return;
    }

    const response = await fetch("http://localhost:5000/api/architectures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newArchitectureName,
      }),
    });

    const newArchitecture = await response.json();

    setArchitectures([...architectures, newArchitecture]);
    setNewArchitectureName("");
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