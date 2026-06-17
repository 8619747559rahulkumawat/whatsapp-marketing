import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import API from '../../utils/api';
import { toast } from 'react-hot-toast';

const AutomationBuilder = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [campaign, setCampaign] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const onConnect = useCallback((connection) => {
    setEdges((eds) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [setEdges]);

  // Initialize flow with basic nodes if none exist
  useEffect(() => {
    const loadCampaign = async () => {
      try {
        const { data } = await API.get(`/campaigns/${campaignId}`);
        setCampaign(data.campaign || data);
        
        if ((data.campaign || data).automationFlow) {
          const saved = JSON.parse((data.campaign || data).automationFlow);
          if (saved.nodes) setNodes(saved.nodes);
          if (saved.edges) setEdges(saved.edges);
        }
      } catch (error) {
        toast.error('Failed to load campaign');
      } finally {
        setIsLoading(false);
      }
    };

    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId, setNodes, setEdges]);

  const handleSave = async () => {
    if (isSaving || !campaignId) return;
    
    try {
      setIsSaving(true);
      const automationFlow = JSON.stringify({ nodes, edges });
      
      await API.put(`/campaigns/${campaignId}`, { automationFlow });
      toast.success('Automation flow saved successfully');
      navigate(`/campaigns/${campaignId}`);
    } catch (error) {
      toast.error('Failed to save automation flow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNode = (type, position) => {
    const [x, y] = position;
    let newNode;

    switch (type) {
      case 'sendMessage':
        newNode = {
          id: `sendmessage-${Date.now()}`,
          type: 'default',
          position: { x, y },
          data: {
            label: 'Send Message',
            message: '',
            templateId: null,
            buttons: []
          }
        };
        break;
        
      case 'waitDelay':
        newNode = {
          id: `wait-${Date.now()}`,
          type: 'default',
          position: { x, y },
          data: {
            label: 'Wait/Delay',
            delayTime: 1000,
            delayUnit: 'seconds'
          }
        };
        break;
        
      case 'condition':
        newNode = {
          id: `condition-${Date.now()}`,
          type: 'default',
          position: { x, y },
          data: {
            label: 'Condition',
            field: '',
            operator: 'equals',
            value: ''
          }
        };
        break;
        
      case 'webhook':
        newNode = {
          id: `webhook-${Date.now()}`,
          type: 'default',
          position: { x, y },
          data: {
            label: 'Webhook',
            url: '',
            method: 'POST',
            headers: {},
            body: ''
          }
        };
        break;
        
      case 'apiCall':
        newNode = {
          id: `api-${Date.now()}`,
          type: 'default',
          position: { x, y },
          data: {
            label: 'API Call',
            url: '',
            method: 'GET',
            headers: {},
            body: ''
          }
        };
        break;
        
      case 'tagUser':
        newNode = {
          id: `tag-${Date.now()}`,
          type: 'default',
          position: { x, y },
          data: {
            label: 'Tag User',
            tags: []
          }
        };
        break;
        
      default:
        return;
    }

    setNodes((nds) => [...nds, newNode]);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Automation Builder</h2>
          
          {/* Node Types */}
          <div className="space-y-2">
            <button 
              onClick={() => handleAddNode('sendMessage', [100, 100])}
              className="w-full text-left bg-gray-50 p-3 rounded border hover:bg-gray-100"
            >
              Send Message
            </button>
            
            <button 
              onClick={() => handleAddNode('waitDelay', [100, 100])}
              className="w-full text-left bg-gray-50 p-3 rounded border hover:bg-gray-100"
            >
              Wait/Delay
            </button>
            
            <button 
              onClick={() => handleAddNode('condition', [100, 100])}
              className="w-full text-left bg-gray-50 p-3 rounded border hover:bg-gray-100"
            >
              Condition
            </button>
            
            <button 
              onClick={() => handleAddNode('webhook', [100, 100])}
              className="w-full text-left bg-gray-50 p-3 rounded border hover:bg-gray-100"
            >
              Webhook
            </button>
            
            <button 
              onClick={() => handleAddNode('apiCall', [100, 100])}
              className="w-full text-left bg-gray-50 p-3 rounded border hover:bg-gray-100"
            >
              API Call
            </button>
            
            <button 
              onClick={() => handleAddNode('tagUser', [100, 100])}
              className="w-full text-left bg-gray-50 p-3 rounded border hover:bg-gray-100"
            >
              Tag User
            </button>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Flow'}
            </button>
          </div>
          </div>
      </aside>
      
      {/* Main Canvas */}
      <section className="flex-1 bg-gray-50 relative">
        <div className="absolute inset-0 p-4">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            className="h-[calc(100vh-4.5rem)] w-full"
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </section>
    </div>
  );
};

export default AutomationBuilder;