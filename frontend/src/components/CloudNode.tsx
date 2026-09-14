import {
  Handle,
  Position,
  NodeToolbar,
  useViewport,
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

import CustomSelect from "./CustomSelect";
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

  runtimeStatus?: {
    nodeId: string;
    containerName: string;
    dockerStatus: string;
    status: string;
  };

  onStopRuntime?: (
    nodeId: string
  ) => void;

  onRestartRuntime?: (
    nodeId: string
  ) => void;
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
  const { zoom } = useViewport();

  return (
    <div
      className={`cloud-node ${
        nodeData.runtimeStatus?.status === "Failed"
          ? "cloud-node-failed"
          : nodeData.runtimeStatus?.status === "Degraded" ||
              nodeData.runtimeStatus?.status === "Unhealthy"
            ? "cloud-node-degraded"
            : nodeData.runtimeStatus
              ? "cloud-node-healthy"
              : ""
      }`}
    >
     <NodeToolbar
      isVisible={selected}
      position={Position.Right}
      offset={14}
    >
      <div
        className="node-toolbar-scale"
        style={{
          zoom: zoom,
        }}
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

              <CustomSelect
                value={nodeData.provider || "AWS"}
                options={["AWS", "Azure"]}
                onChange={(value) =>
                  nodeData.onUpdate?.(
                    id,
                    "provider",
                    value
                  )
                }
              />
            </label>
            <label>
              Region

              <CustomSelect
                value={
                  nodeData.region || "us-east-1"
                }
                options={
                  nodeData.provider === "Azure"
                    ? [
                        "canada-central",
                        "east-us",
                        "west-europe",
                      ]
                    : [
                        "us-east-1",
                        "us-west-2",
                        "ca-central-1",
                      ]
                }
                onChange={(value) =>
                  nodeData.onUpdate?.(
                    id,
                    "region",
                    value
                  )
                }
              />
            </label>

            <label>
              Capacity

              <div className="capacity-input">
                <input
                  type="text"
                  inputMode="numeric"
                  value={nodeData.capacity ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (value === "" || /^\d+$/.test(value)) {
                      nodeData.onUpdate?.(
                        id,
                        "capacity",
                        value === "" ? "" : Number(value)
                      );
                    }
                  }}
                  onBlur={(event) => {
                    if (event.target.value === "") {
                      nodeData.onUpdate?.(
                        id,
                        "capacity",
                        500
                      );
                    }
                  }}
                />

                <div className="capacity-controls">
                  <button
                    type="button"
                    className="capacity-arrow"
                    onClick={() =>
                      nodeData.onUpdate?.(
                        id,
                        "capacity",
                        (Number(nodeData.capacity) || 0) + 10
                      )
                    }
                  >
                    ▲
                  </button>

                  <button
                    type="button"
                    className="capacity-arrow"
                    onClick={() =>
                      nodeData.onUpdate?.(
                        id,
                        "capacity",
                        Math.max(
                          0,
                          (Number(nodeData.capacity) || 0) - 10
                        )
                      )
                    }
                  >
                    ▼
                  </button>
                </div>
              </div>
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
              {nodeData.runtimeStatus &&
                nodeData.runtimeStatus.status !== "Failed" &&
                nodeData.runtimeStatus.status !== "Not Deployed" && (
                  <button
                    className="simulate-failure-button"
                    onClick={() =>
                      nodeData.onStopRuntime?.(id)
                    }
                  >
                    Simulate Failure
                  </button>
                )}
              {nodeData.runtimeStatus?.status ===
                "Failed" && (
                <button
                  className="recover-service-button"
                  onClick={() =>
                    nodeData.onRestartRuntime?.(id)
                  }
                >
                  Recover Service
                </button>
              )}
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
              nodeData.runtimeStatus?.status === "Failed"
                ? "failed-text"
                : nodeData.runtimeStatus?.status === "Degraded" ||
                    nodeData.runtimeStatus?.status === "Unhealthy"
                  ? "degraded-text"
                  : "healthy-text"
            }
          >
            {nodeData.runtimeStatus?.status ||
              nodeData.status ||
              "Healthy"}
          </span>
        </div>
      </div>
    </div>
  );
}