import { Handle, Position, type NodeProps } from "@xyflow/react";
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

export default function CloudNode({ data }: NodeProps) {
  const nodeData = data as CloudNodeData;

  return (
    <div className="cloud-node">
      <Handle
        type="target"
        position={Position.Top}
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

      <Handle
        type="source"
        position={Position.Bottom}
        className="cloud-handle"
      />

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