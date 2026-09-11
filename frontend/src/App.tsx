type Architecture = {
  id: number;
  name: string;
  status: string;
};

const architectures: Architecture[] = [
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
];

function App() {
  return (
    <main>
      <h1>Failover</h1>

      <p>
        Design, simulate, and test resilient cloud architectures.
      </p>

      <h2>Your Architectures</h2>

      <button>Create Architecture</button>

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