import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const nodeBase = 'px-4 py-3 rounded-xl border min-w-[180px] shadow-lg';

const NodeHeader = ({ label, color }) => (
  <div className={`text-xs font-semibold uppercase tracking-wider ${color} mb-2`}>{label}</div>
);

export const TriggerNode = memo(({ data }) => (
  <div className={`${nodeBase} bg-green-900/30 border-green-500/30`}>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-500" />
    <NodeHeader label="Trigger" color="text-green-400" />
    <div className="text-white text-sm font-medium">{data.label}</div>
    {data.config && <div className="text-gray-400 text-xs mt-1">{data.config}</div>}
  </div>
));

export const SendMessageNode = memo(({ data }) => (
  <div className={`${nodeBase} bg-purple-900/30 border-purple-500/30`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500" />
    <NodeHeader label="Send Message" color="text-purple-400" />
    <div className="text-white text-sm font-medium">{data.label}</div>
    {data.message && <div className="text-gray-400 text-xs mt-1 truncate">{data.message}</div>}
  </div>
));

export const WaitDelayNode = memo(({ data }) => (
  <div className={`${nodeBase} bg-amber-900/30 border-amber-500/30`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500" />
    <NodeHeader label="Wait / Delay" color="text-amber-400" />
    <div className="text-white text-sm font-medium">{data.label}</div>
    {data.delayTime && <div className="text-gray-400 text-xs mt-1">{data.delayTime} {data.delayUnit}</div>}
  </div>
));

export const ConditionNode = memo(({ data }) => (
  <div className={`${nodeBase} bg-blue-900/30 border-blue-500/30`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500" />
    <Handle type="source" position={Position.Right} id="true" className="w-3 h-3 bg-green-500" />
    <Handle type="source" position={Position.Left} id="false" className="w-3 h-3 bg-red-500" />
    <NodeHeader label="Condition" color="text-blue-400" />
    <div className="text-white text-sm font-medium">{data.label}</div>
    {data.field && <div className="text-gray-400 text-xs mt-1">{data.field} {data.operator} {data.value}</div>}
  </div>
));

export const WebhookNode = memo(({ data }) => (
  <div className={`${nodeBase} bg-rose-900/30 border-rose-500/30`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-rose-500" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-rose-500" />
    <NodeHeader label="Webhook" color="text-rose-400" />
    <div className="text-white text-sm font-medium">{data.label}</div>
    {data.url && <div className="text-gray-400 text-xs mt-1 truncate">{data.url}</div>}
  </div>
));

export const nodeTypes = {
  trigger: TriggerNode,
  sendMessage: SendMessageNode,
  waitDelay: WaitDelayNode,
  condition: ConditionNode,
  webhook: WebhookNode,
};
