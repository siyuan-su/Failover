import {
  Handle,
  Position,
  NodeToolbar,
  type NodeProps,
} from "@xyflow/react";

import {
  Network,
  Server,
  Database,
  Layers,
  Cog,
  Globe,
} from "lucide-react";

import "./CloudNode.css";

type CloudNodeData = {
  label: string;
  componentType: string;

  provider?: string;
  region?: string;
  capacity?: number;
  status?: string;

  onUpdate?: (
    nodeId: string,
    field: string,
    value: string | number
  ) => void;

  onDelete?: (nodeId: string) => void;

  onDeploy?: (nodeId: string) => void;

  deploying?: boolean;

  deployment?: {
  error?: string;

  deployment?: {
    containerName: string;
    serviceName: string;
    hostPort: number;
    status: string;
  };
};
};

function getIcon(componentType: string) {
  switch (componentType) {
    case "Load Balancer":
      return <Network size={30} />;

    case "API Server":
      return <Server size={30} />;

    case "Web Server":
      return <Globe size={30} />;

    case "MySQL Database":
      return <Database size={30} />;

    case "Redis Cache":
      return <Layers size={30} />;

    case "Worker":
      return <Cog size={30} />;

    default:
      return <Server size={30} />;
  }
}

export default function CloudNode({
  id,
  data,
  selected,
}: NodeProps) {
  const nodeData = data as CloudNodeData;

  return (
    <div className="cloud-node">
      <NodeToolbar
        isVisible={selected}
        position={Position.Right}
        offset={18}
      >
        <div className="node-toolbar-row">
          <div className="node-popup">
            <div className="node-popup-header">
              <strong>Component Settings</strong>
            </div>

            <label>
              Name

              <input
                value={nodeData.label}
                onChange={(event) =>
                  nodeData.onUpdate?.(
                    id,
                    "label",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Provider

              <select
                value={nodeData.provider || "AWS"}
                onChange={(event) =>
                  nodeData.onUpdate?.(
                    id,
                    "provider",
                    event.target.value
                  )
                }
              >
                <option value="AWS">AWS</option>
                <option value="Azure">Azure</option>
              </select>
            </label>

            <label>
              Region

              <select
                value={nodeData.region || "us-east-1"}
                onChange={(event) =>
                  nodeData.onUpdate?.(
                    id,
                    "region",
                    event.target.value
                  )
                }
              >
                {nodeData.provider === "Azure" ? (
                  <>
                    <option value="canada-central">
                      Canada Central
                    </option>

                    <option value="east-us">
                      East US
                    </option>

                    <option value="west-europe">
                      West Europe
                    </option>
                  </>
                ) : (
                  <>
                    <option value="us-east-1">
                      us-east-1
                    </option>

                    <option value="us-west-2">
                      us-west-2
                    </option>

                    <option value="ca-central-1">
                      ca-central-1
                    </option>
                  </>
                )}
              </select>
            </label>

            <label>
              Capacity

              <input
                type="number"
                min="1"
                value={nodeData.capacity || 500}
                onChange={(event) =>
                  nodeData.onUpdate?.(
                    id,
                    "capacity",
                    Number(event.target.value)
                  )
                }
              />
            </label>

            <div className="node-popup-actions">
              {nodeData.componentType === "API Server" && (
                <button
                  className="popup-deploy-button"
                  disabled={nodeData.deploying}
                  onClick={() =>
                    nodeData.onDeploy?.(id)
                  }
                >
                  {nodeData.deploying
                    ? "Deploying..."
                    : "Deploy Locally"}
                </button>
              )}

              <button
                className="popup-delete-button"
                onClick={() =>
                  nodeData.onDelete?.(id)
                }
              >
                Delete
              </button>
            </div>
          </div>

          {nodeData.deployment && (
            <div className="deployment-card">
              <div className="deployment-card-header">
                <div>
                  <span className="deployment-eyebrow">
                    Deployment
                  </span>

                  <strong>
                    {nodeData.deployment.deployment?.serviceName}
                  </strong>
                </div>

                <div className="deployment-status-pill">
                  <span className="status-dot" />
                  {nodeData.deployment.deployment?.status}
                </div>
              </div>

              {nodeData.deployment.error ? (
                <div className="deployment-failed">
                  {nodeData.deployment.error}
                </div>
              ) : (
                <>
                  <div className="deployment-info-list">
                    <div className="deployment-info-row">
                      <span>Container</span>

                      <code>
                        {
                          nodeData.deployment.deployment
                            ?.containerName
                        }
                      </code>
                    </div>

                    <div className="deployment-info-row">
                      <span>Endpoint</span>

                      <code>
                        localhost:
                        {
                          nodeData.deployment.deployment
                            ?.hostPort
                        }
                      </code>
                    </div>

                    <div className="deployment-info-row">
                      <span>Health Check</span>

                      <code>/health</code>
                    </div>
                  </div>

                  <a
                    className="health-link"
                    href={`http://localhost:${
                      nodeData.deployment.deployment
                        ?.hostPort
                    }/health`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Health Endpoint
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </NodeToolbar>
      {/* TOP */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="cloud-handle"
      />

      {/* RIGHT */}
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="cloud-handle"
      />

      {/* BOTTOM */}
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="cloud-handle"
      />

      {/* LEFT */}
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="cloud-handle"
      />

      <div className="cloud-node-content">
        <div className="cloud-node-icon">
          {getIcon(nodeData.componentType)}
        </div>

        <div className="cloud-node-divider" />

        <div className="cloud-node-label">
          {nodeData.label}
        </div>
      </div>

      <div className="cloud-node-tooltip">
        <div className="tooltip-title">
          {nodeData.label}
        </div>

        <div className="tooltip-row">
          <span>Provider</span>
          <span>{nodeData.provider || "AWS"}</span>
        </div>

        <div className="tooltip-row">
          <span>Region</span>
          <span>{nodeData.region || "us-east-1"}</span>
        </div>

        <div className="tooltip-row">
          <span>Capacity</span>
          <span>
            {nodeData.capacity || 500} req/s
          </span>
        </div>

        <div className="tooltip-row">
          <span>Status</span>
          <span
            className={
              nodeData.status === "Healthy" || !nodeData.status
                ? "healthy-text"
                : "unhealthy-text"
            }
          >
            {nodeData.status || "Healthy"}
          </span>
        </div>
      </div>
    </div>
  );
}