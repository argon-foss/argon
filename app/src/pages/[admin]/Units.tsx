import React, { useState, useEffect } from 'react';
import { ChevronRightIcon, TrashIcon, PencilIcon, ArrowLeftIcon, PackageIcon, PlusIcon, InfoIcon, TagIcon } from 'lucide-react';
import { z } from 'zod';
import AdminBar from '../../components/AdminBar';
import LoadingSpinner from '../../components/LoadingSpinner';
import { saveAs } from 'file-saver';

// V3: Schema for Docker images
const dockerImageSchema = z.object({
  image: z.string().min(1),
  displayName: z.string().min(1)
});

// V3: Schema for unit features
const unitFeatureSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  iconPath: z.string().optional(),
  type: z.enum(['required', 'optional']),
  uiData: z.object({
    component: z.string(),
    props: z.record(z.any()).optional()
  }).optional()
});

// V3: Schema for unit metadata
const unitMetaSchema = z.object({
  version: z.string().default('argon/unit:v3'),
  author: z.string().optional(),
  website: z.string().optional(),
  supportUrl: z.string().optional()
});

// Schemas matching backend validation
const environmentVariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  defaultValue: z.string(),
  required: z.boolean().default(false),
  userViewable: z.boolean().default(true),
  userEditable: z.boolean().default(false),
  rules: z.string()
});

const configFileSchema = z.object({
  path: z.string().min(1),
  content: z.string()
});

const installScriptSchema = z.object({
  dockerImage: z.string(),
  entrypoint: z.string().default('bash'),
  script: z.string()
});

// V3: Updated unit schema
const unitSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  shortName: z.string().min(1).max(20).regex(/^[a-z0-9-]+$/),
  description: z.string(),
  // V3: Multiple docker images with display names
  dockerImages: z.array(dockerImageSchema).min(1),
  // V3: Default image to use
  defaultDockerImage: z.string(),
  // Legacy field kept for backward compatibility
  dockerImage: z.string(),
  defaultStartupCommand: z.string(),
  configFiles: z.array(configFileSchema).default([]),
  environmentVariables: z.array(environmentVariableSchema).default([]),
  installScript: installScriptSchema,
  // V3: Enhanced startup configuration
  startup: z.object({
    userEditable: z.boolean().default(false),
    readyRegex: z.string().optional(),
    stopCommand: z.string().optional()
  }).default({}),
  // V3: Features section
  features: z.array(unitFeatureSchema).default([]),
  // V3: Meta information
  meta: unitMetaSchema.default({
    version: 'argon/unit:v3'
  }),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

// Container schema
const containerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  items: z.array(z.object({
    cargoId: z.string(),
    targetPath: z.string()
  })),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

type Unit = z.infer<typeof unitSchema>;
type Container = z.infer<typeof containerSchema>;
type View = 'list' | 'create' | 'view' | 'edit';

// V3: Docker Images Form Component
const DockerImagesForm: React.FC<{
  images: Unit['dockerImages'],
  defaultImage: string,
  onChange: (images: Unit['dockerImages'], defaultImage: string) => void
}> = ({ images, defaultImage, onChange }) => {
  const addImage = () => {
    const newImages = [...images, {
      image: '',
      displayName: ''
    }];
    onChange(newImages, defaultImage || (newImages.length > 0 ? newImages[0].image : ''));
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    let newDefaultImage = defaultImage;
    
    // If we're removing the default image, set a new default
    if (newImages.length > 0 && !newImages.some(img => img.image === defaultImage)) {
      newDefaultImage = newImages[0].image;
    }
    
    onChange(newImages, newDefaultImage);
  };

  const updateImage = (index: number, field: keyof typeof images[0], value: string) => {
    const newImages = images.map((img, i) => i === index ? { ...img, [field]: value } : img);
    
    // If updating the image value of the default, update the default too
    let newDefaultImage = defaultImage;
    if (field === 'image' && images[index].image === defaultImage) {
      newDefaultImage = value;
    }
    
    onChange(newImages, newDefaultImage);
  };

  const setAsDefault = (image: string) => {
    onChange(images, image);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-700">Docker Images</label>
        <button
          type="button"
          onClick={addImage}
          className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Add Image
        </button>
      </div>

      {images.map((image, index) => (
        <div key={index} className="border border-gray-200 rounded-md p-3 space-y-3">
          <div className="flex justify-between items-start">
            <div className="grow space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={image.image}
                  onChange={(e) => updateImage(index, 'image', e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                  placeholder="Docker Image Path (e.g., itzg/minecraft-server:java17)"
                />
                <input
                  type="text"
                  value={image.displayName}
                  onChange={(e) => updateImage(index, 'displayName', e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                  placeholder="Display Name (e.g., Java 17)"
                />
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setAsDefault(image.image)}
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    defaultImage === image.image 
                      ? 'bg-green-50 text-green-600 border border-green-200' 
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {defaultImage === image.image ? 'Default Image' : 'Set as Default'}
                </button>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="ml-2 p-1 text-gray-400 hover:text-red-500"
              disabled={images.length <= 1} // Cannot remove the last image
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {images.length === 0 && (
        <div className="text-center py-4 border border-gray-200 border-dashed rounded-md">
          <p className="text-xs text-gray-500">Add at least one Docker image</p>
        </div>
      )}
    </div>
  );
};

// V3: Features Form Component
const FeaturesForm: React.FC<{
  features: Unit['features'],
  onChange: (features: Unit['features']) => void
}> = ({ features, onChange }) => {
  const addFeature = () => {
    onChange([...features, {
      name: '',
      description: '',
      type: 'optional',
      uiData: {
        component: 'checkbox',
        props: {}
      }
    }]);
  };

  const removeFeature = (index: number) => {
    onChange(features.filter((_, i) => i !== index));
  };

  const updateFeature = (index: number, field: string, value: any) => {
    onChange(features.map((f, i) => {
      if (i !== index) return f;
      
      // Handle nested fields
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...f,
          [parent]: {
            ...(f[parent as keyof typeof f] as Record<string, any>),
            [child]: value
          }
        };
      }
      
      return { ...f, [field]: value };
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-700">Features</label>
        <button
          type="button"
          onClick={addFeature}
          className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Add Feature
        </button>
      </div>

      {features.map((feature, index) => (
        <div key={index} className="border border-gray-200 rounded-md p-3 space-y-3">
          <div className="flex justify-between items-start">
            <div className="grow space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={feature.name}
                  onChange={(e) => updateFeature(index, 'name', e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                  placeholder="Feature Name (e.g., eula-agreement)"
                />
                <select
                  value={feature.type}
                  onChange={(e) => updateFeature(index, 'type', e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                >
                  <option value="required">Required</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
              
              <input
                type="text"
                value={feature.description || ''}
                onChange={(e) => updateFeature(index, 'description', e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                placeholder="Description (e.g., Accept the Minecraft EULA)"
              />
              
              <input
                type="text"
                value={feature.iconPath || ''}
                onChange={(e) => updateFeature(index, 'iconPath', e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                placeholder="Icon Path (optional, e.g., /assets/icons/document.svg)"
              />
              
              {feature.uiData && (
                <>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <div className="text-xs font-medium text-gray-700 mb-2">UI Component Configuration</div>
                    
                    <select
                      value={feature.uiData.component}
                      onChange={(e) => updateFeature(index, 'uiData.component', e.target.value)}
                      className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md mb-2"
                    >
                      <option value="checkbox">Checkbox</option>
                      <option value="select">Select (Dropdown)</option>
                    </select>
                    
                    {feature.uiData.component === 'checkbox' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={feature.uiData.props?.label || ''}
                          onChange={(e) => updateFeature(index, 'uiData.props', { 
                            ...feature.uiData.props, 
                            label: e.target.value 
                          })}
                          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                          placeholder="Checkbox Label (e.g., I accept the EULA)"
                        />
                        <input
                          type="text"
                          value={feature.uiData.props?.link || ''}
                          onChange={(e) => updateFeature(index, 'uiData.props', { 
                            ...feature.uiData.props, 
                            link: e.target.value 
                          })}
                          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                          placeholder="Link URL (optional, e.g., https://minecraft.net/eula)"
                        />
                      </div>
                    )}
                    
                    {feature.uiData.component === 'select' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={feature.uiData.props?.label || ''}
                          onChange={(e) => updateFeature(index, 'uiData.props', { 
                            ...feature.uiData.props, 
                            label: e.target.value 
                          })}
                          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                          placeholder="Select Label (e.g., Java Version)"
                        />
                        
                        <div className="text-xs text-gray-700 mt-2 mb-1">Options:</div>
                        {feature.uiData.props?.options?.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={option.value}
                              onChange={(e) => {
                                const newOptions = [...(feature.uiData.props?.options || [])];
                                newOptions[optIdx] = { ...option, value: e.target.value };
                                updateFeature(index, 'uiData.props', { 
                                  ...feature.uiData.props, 
                                  options: newOptions 
                                });
                              }}
                              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                              placeholder="Value"
                            />
                            <input
                              type="text"
                              value={option.label}
                              onChange={(e) => {
                                const newOptions = [...(feature.uiData.props?.options || [])];
                                newOptions[optIdx] = { ...option, label: e.target.value };
                                updateFeature(index, 'uiData.props', { 
                                  ...feature.uiData.props, 
                                  options: newOptions 
                                });
                              }}
                              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                              placeholder="Label"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newOptions = feature.uiData.props?.options?.filter((_, i) => i !== optIdx) || [];
                                updateFeature(index, 'uiData.props', { 
                                  ...feature.uiData.props, 
                                  options: newOptions 
                                });
                              }}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <TrashIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => {
                            const options = feature.uiData.props?.options || [];
                            updateFeature(index, 'uiData.props', { 
                              ...feature.uiData.props, 
                              options: [...options, { value: '', label: '' }] 
                            });
                          }}
                          className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 mt-1"
                        >
                          Add Option
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => removeFeature(index)}
              className="ml-2 p-1 text-gray-400 hover:text-red-500"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {features.length === 0 && (
        <div className="text-center py-4 border border-gray-200 border-dashed rounded-md">
          <p className="text-xs text-gray-500">No features defined</p>
        </div>
      )}
    </div>
  );
};

// V3: Meta Form Component
const MetaForm: React.FC<{
  meta: Unit['meta'],
  onChange: (meta: Unit['meta']) => void
}> = ({ meta, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-700">Metadata</label>
      </div>
      
      <div className="border border-gray-200 rounded-md p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Version</label>
            <input
              type="text"
              value={meta.version}
              readOnly
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Author</label>
            <input
              type="text"
              value={meta.author || ''}
              onChange={(e) => onChange({ ...meta, author: e.target.value })}
              className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
              placeholder="Author name or organization"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-500 mb-1">Website</label>
          <input
            type="text"
            value={meta.website || ''}
            onChange={(e) => onChange({ ...meta, website: e.target.value })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
            placeholder="https://example.com"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-500 mb-1">Support URL</label>
          <input
            type="text"
            value={meta.supportUrl || ''}
            onChange={(e) => onChange({ ...meta, supportUrl: e.target.value })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
            placeholder="https://support.example.com"
          />
        </div>
      </div>
    </div>
  );
};

// Environment Variables Form Component
const EnvironmentVariableForm: React.FC<{
  variables: Unit['environmentVariables'],
  onChange: (variables: Unit['environmentVariables']) => void
}> = ({ variables, onChange }) => {
  const addVariable = () => {
    onChange([...variables, {
      name: '',
      description: '',
      defaultValue: '',
      required: false,
      userViewable: true,
      userEditable: false,
      rules: 'string'
    }]);
  };

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof typeof variables[0], value: any) => {
    onChange(variables.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-700">Environment Variables</label>
        <button
          type="button"
          onClick={addVariable}
          className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Add Variable
        </button>
      </div>

      {variables.map((variable, index) => (
        <div key={index} className="border border-gray-200 rounded-md p-3 space-y-3">
          <div className="flex justify-between items-start">
            <div className="grow space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={variable.name}
                  onChange={(e) => updateVariable(index, 'name', e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                  placeholder="Variable Name"
                />
                <input
                  type="text"
                  value={variable.defaultValue}
                  onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                  placeholder="Default Value"
                />
              </div>
              
              <input
                type="text"
                value={variable.description || ''}
                onChange={(e) => updateVariable(index, 'description', e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                placeholder="Description (optional)"
              />
              
              <input
                type="text"
                value={variable.rules}
                onChange={(e) => updateVariable(index, 'rules', e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                placeholder="Validation Rules (e.g., string|max:20)"
              />

              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={variable.required}
                    onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                    className="text-xs"
                  />
                  <span className="text-xs">Required</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={variable.userViewable}
                    onChange={(e) => updateVariable(index, 'userViewable', e.target.checked)}
                    className="text-xs"
                  />
                  <span className="text-xs">User Viewable</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={variable.userEditable}
                    onChange={(e) => updateVariable(index, 'userEditable', e.target.checked)}
                    className="text-xs"
                  />
                  <span className="text-xs">User Editable</span>
                </label>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => removeVariable(index)}
              className="ml-2 p-1 text-gray-400 hover:text-red-500"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {variables.length === 0 && (
        <div className="text-center py-4 border border-gray-200 border-dashed rounded-md">
          <p className="text-xs text-gray-500">No variables defined</p>
        </div>
      )}
    </div>
  );
};

// Config Files Form Component
const ConfigFilesForm: React.FC<{
  files: Unit['configFiles'],
  onChange: (files: Unit['configFiles']) => void
}> = ({ files, onChange }) => {
  const addFile = () => {
    onChange([...files, {
      path: '',
      content: ''
    }]);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  const updateFile = (index: number, field: keyof typeof files[0], value: string) => {
    onChange(files.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-700">Configuration Files</label>
        <button
          type="button"
          onClick={addFile}
          className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Add File
        </button>
      </div>

      {files.map((file, index) => (
        <div key={index} className="border border-gray-200 rounded-md p-3 space-y-3">
          <div className="flex justify-between items-start">
            <div className="grow space-y-3">
              <input
                type="text"
                value={file.path}
                onChange={(e) => updateFile(index, 'path', e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
                placeholder="File Path (e.g., server.properties)"
              />
              
              <textarea
                value={file.content}
                onChange={(e) => updateFile(index, 'content', e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md font-mono"
                placeholder="File Content"
                rows={5}
              />
            </div>
            
            <button
              type="button"
              onClick={() => removeFile(index)}
              className="ml-2 p-1 text-gray-400 hover:text-red-500"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {files.length === 0 && (
        <div className="text-center py-4 border border-gray-200 border-dashed rounded-md">
          <p className="text-xs text-gray-500">No configuration files defined</p>
        </div>
      )}
    </div>
  );
};

// Container List Component
const ContainerList: React.FC<{
  unitId: string | undefined;
  assignedContainers: Container[];
  onRefresh: () => void;
}> = ({ unitId, assignedContainers, onRefresh }) => {
  const [allContainers, setAllContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContainerSelector, setShowContainerSelector] = useState(false);

  useEffect(() => {
    if (showContainerSelector) {
      fetchAllContainers();
    }
  }, [showContainerSelector]);

  const fetchAllContainers = async () => {
    if (!unitId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/cargo/container', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // If we get a 404, it might be that there are no containers yet
          setAllContainers([]);
          return [];
        }
        throw new Error('Failed to fetch containers');
      }
      
      const data = await response.json();
      setAllContainers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const assignContainer = async (containerId: string) => {
    if (!unitId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/units/${unitId}/containers/${containerId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to assign container');
      
      onRefresh();
      setShowContainerSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign container');
    }
  };

  const removeContainer = async (containerId: string) => {
    if (!unitId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/units/${unitId}/containers/${containerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to remove container');
      
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove container');
    }
  };

  // Filter out already assigned containers
  const availableContainers = allContainers.filter(
    container => !assignedContainers.some(ac => ac.id === container.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-700">Cargo Containers</label>
        <button
          type="button"
          onClick={() => setShowContainerSelector(!showContainerSelector)}
          className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 flex items-center"
        >
          <PlusIcon className="w-3 h-3 mr-1" />
          Add Container
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-2 rounded-md text-xs">
          {error}
        </div>
      )}

      {/* Container Selector */}
      {showContainerSelector && (
        <div className="border border-gray-200 rounded-md p-3">
          <h4 className="text-xs font-medium mb-2">Select a container to add</h4>
          {loading ? (
            <div className="text-center py-4">
              <span className="text-xs text-gray-500">Loading...</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableContainers.length > 0 ? (
                availableContainers.map(container => (
                  <div 
                    key={container.id}
                    className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md border border-gray-100"
                  >
                    <div>
                      <div className="text-sm font-medium">{container.name}</div>
                      <div className="text-xs text-gray-500">{container.items.length} items</div>
                    </div>
                    <button
                      onClick={() => assignContainer(container.id)}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Add
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-500">No available containers</p>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setShowContainerSelector(false)}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assigned Containers List */}
      <div>
        {assignedContainers.length > 0 ? (
          <div className="space-y-2">
            {assignedContainers.map(container => (
              <div 
                key={container.id}
                className="border border-gray-200 rounded-md p-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">{container.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{container.description}</div>
                    
                    {container.items && container.items.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-gray-700 mb-1">Items:</div>
                        <div className="space-y-1 ml-2">
                          {container.items.map((item, idx) => (
                            <div key={idx} className="text-xs">
                              → <span className="font-mono">{item.targetPath}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeContainer(container.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 border border-gray-200 border-dashed rounded-md">
            <div className="flex flex-col items-center justify-center">
              <PackageIcon className="w-5 h-5 text-gray-400 mb-1" />
              <p className="text-xs text-gray-500">No containers assigned</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminUnitsPage: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [assignedContainers, setAssignedContainers] = useState<Container[]>([]);
  
  // V3: Updated initial form state
  const [formData, setFormData] = useState<Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    shortName: '',
    description: '',
    // V3: Multiple Docker images
    dockerImages: [{ image: '', displayName: 'Default Image' }],
    defaultDockerImage: '',
    // Legacy field
    dockerImage: '',
    defaultStartupCommand: '',
    configFiles: [],
    environmentVariables: [],
    installScript: {
      dockerImage: '',
      entrypoint: 'bash',
      script: ''
    },
    // V3: Enhanced startup configuration
    startup: {
      userEditable: false,
      readyRegex: '',
      stopCommand: ''
    },
    // V3: Features section
    features: [] as Unit['features'], // Explicitly type the features array
    // V3: Meta information
    meta: {
      version: 'argon/unit:v3',
      author: '',
      website: '',
      supportUrl: ''
    }
  });
  
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/units', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch units');
      
      const data = await response.json();
      setUnits(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const fetchUnitContainers = async (unitId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/units/${unitId}/containers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch unit containers');
      
      const data = await response.json();
      setAssignedContainers(data);
    } catch (err) {
      console.error('Failed to fetch containers:', err);
      setAssignedContainers([]);
    }
  };

  useEffect(() => {
    if (selectedUnit?.id && (view === 'view' || view === 'edit')) {
      fetchUnitContainers(selectedUnit.id);
    }
  }, [selectedUnit, view]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    try {
      const validatedData = unitSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(formData);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validatedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create unit');
      }

      await fetchUnits();
      setView('list');
      resetForm();
    } catch (err) {
      if (err instanceof z.ZodError) {
        setFormError('Invalid input. Please check your data.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to create unit');
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    setFormError(null);

    try {
      const validatedData = unitSchema.partial().omit({ id: true, createdAt: true, updatedAt: true }).parse(formData);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/units/${selectedUnit.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validatedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update unit');
      }

      await fetchUnits();
      setView('list');
      resetForm();
    } catch (err) {
      if (err instanceof z.ZodError) {
        setFormError('Invalid input. Please check your data.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to update unit');
      }
    }
  };

  const handleDelete = async (unitId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/units/${unitId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete unit');
      }

      await fetchUnits();
      if (selectedUnit?.id === unitId) {
        setView('list');
        setSelectedUnit(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  };

  const resetForm = () => {
    // V3: Updated form reset with V3 fields
    setFormData({
      name: '',
      shortName: '',
      description: '',
      dockerImages: [{ image: '', displayName: 'Default Image' }],
      defaultDockerImage: '',
      dockerImage: '',
      defaultStartupCommand: '',
      configFiles: [],
      environmentVariables: [],
      installScript: {
        dockerImage: '',
        entrypoint: 'bash',
        script: ''
      },
      startup: {
        userEditable: false,
        readyRegex: '',
        stopCommand: ''
      },
      features: [] as Unit['features'],
      meta: {
        version: 'argon/unit:v3',
        author: '',
        website: '',
        supportUrl: ''
      }
    });
    setSelectedUnit(null);
    setAssignedContainers([]);
  };

  const handleExport = (unit: Unit) => {
    // V3: Export updated with V3 fields
    const exportData = {
      name: unit.name,
      shortName: unit.shortName,
      description: unit.description,
      dockerImages: unit.dockerImages,
      defaultDockerImage: unit.defaultDockerImage,
      dockerImage: unit.dockerImage,
      defaultStartupCommand: unit.defaultStartupCommand,
      configFiles: unit.configFiles,
      environmentVariables: unit.environmentVariables,
      installScript: unit.installScript,
      startup: unit.startup,
      features: unit.features,
      meta: unit.meta
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    saveAs(blob, `unit-${unit.shortName}.json`);
  };
  
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedUnit = JSON.parse(content);
        
        // V3: Handle older export formats
        if (importedUnit.dockerImage && (!importedUnit.dockerImages || importedUnit.dockerImages.length === 0)) {
          importedUnit.dockerImages = [{ 
            image: importedUnit.dockerImage, 
            displayName: 'Default Image' 
          }];
          importedUnit.defaultDockerImage = importedUnit.dockerImage;
        }
        
        // V3: Ensure meta is present
        if (!importedUnit.meta) {
          importedUnit.meta = { version: 'argon/unit:v3' };
        }
        
        // V3: Ensure features array exists
        if (!importedUnit.features) {
          importedUnit.features = [];
        }
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/units/import', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: (() => {
            const formData = new FormData();
            const blob = new Blob([JSON.stringify(importedUnit)], { type: 'application/json' });
            formData.append('file', blob, 'unit.json');
            return formData;
          })()
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Import failed');
        }
        
        await fetchUnits();
        setView('list');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import unit');
      }
    };
    
    reader.readAsText(file);
  };

  const handleImportEgg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let rawegg = JSON.parse(content);

        // Clean it
        if (typeof rawegg === 'string') {
          rawegg = rawegg
                    .replace('{{', '%')
                    .replace('}}', '%');
          rawegg = JSON.parse(rawegg);
        }
        
        // V3: Convert Pterodactyl egg to Argon unit with v3 features
        const unit = {
          name: rawegg.name,
          shortName: rawegg.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: rawegg.description,
          // V3: Convert single image to docker images array
          dockerImages: [{ 
            image: Object.values(rawegg.docker_images)[0] as string, 
            displayName: 'Default Image' 
          }],
          defaultDockerImage: Object.values(rawegg.docker_images)[0] as string,
          dockerImage: Object.values(rawegg.docker_images)[0] as string,
          defaultStartupCommand: rawegg.startup,
          configFiles: [],
          environmentVariables: rawegg.variables.map((v: any) => ({
            name: v.env_variable,
            description: v.description,
            defaultValue: v.default_value,
            required: v.rules.includes('required'),
            userViewable: v.user_viewable,
            userEditable: v.user_editable,
            rules: v.rules
          })),
          installScript: {
            dockerImage: rawegg.scripts.installation.container,
            entrypoint: rawegg.scripts.installation.entrypoint,
            script: rawegg.scripts.installation.script
          },
          // V3: Enhanced startup information if available
          startup: {
            userEditable: true,
            readyRegex: rawegg.config?.container?.startup?.done || '',
            stopCommand: rawegg.config?.container?.stop || ''
          },
          // V3: Add features based on egg data
          features: [] as Unit['features'],
          // V3: Add metadata
          meta: {
            version: 'argon/unit:v3',
            author: rawegg.author || 'Imported from Pterodactyl',
            website: '',
            supportUrl: ''
          }
        };

        // Add EULA feature if needed
        if (unit.environmentVariables.some((v: { name: string; }) => v.name === 'EULA' || v.name === 'MC_EULA')) {
          unit.features.push({
            name: 'eula-agreement',
            description: 'Minecraft EULA acceptance is required to run the server',
            type: 'required',
            uiData: {
              component: 'checkbox',
              props: {
                label: 'I accept the Minecraft End User License Agreement',
                link: 'https://www.minecraft.net/en-us/eula'
              }
            }
          });
        }

        const token = localStorage.getItem('token');
        const response = await fetch('/api/units', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(unit)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Import failed');
        }
        
        await fetchUnits();
        setView('list');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import Pterodactyl egg');
      }
    };
    
    reader.readAsText(file);
  };

  // V3: Updated unit form with new fields
  const renderUnitForm = (type: 'create' | 'edit') => (
    <form onSubmit={type === 'create' ? handleCreate : handleUpdate} className="space-y-4 max-w-lg">
      {formError && (
        <div className="bg-red-50 border border-red-100 rounded-md p-3">
          <p className="text-xs text-red-600">{formError}</p>
        </div>
      )}

      {/* Basic Unit Information */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
          placeholder="Minecraft Java Server"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Short Name (lowercase, numbers, hyphens)</label>
        <input
          type="text"
          value={formData.shortName}
          onChange={(e) => setFormData({ ...formData, shortName: e.target.value.toLowerCase() })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
          placeholder="minecraft-java"
          pattern="[a-z0-9-]+"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
          placeholder="Detailed description of the unit..."
          rows={3}
          required
        />
      </div>

      {/* V3: Docker Images Configuration */}
      <DockerImagesForm 
        images={formData.dockerImages}
        defaultImage={formData.defaultDockerImage}
        onChange={(images, defaultImage) => setFormData({
          ...formData,
          dockerImages: images,
          defaultDockerImage: defaultImage,
          dockerImage: defaultImage // Keep legacy field in sync
        })}
      />

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Default Startup Command</label>
        <input
          type="text"
          value={formData.defaultStartupCommand}
          onChange={(e) => setFormData({ ...formData, defaultStartupCommand: e.target.value })}
          className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
          placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar"
          required
        />
      </div>

      {/* V3: Enhanced Startup Configuration */}
      <div className="space-y-3 p-3 border border-gray-200 rounded-md">
        <label className="block text-xs font-medium text-gray-700">Startup Configuration</label>
        
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.startup.userEditable}
              onChange={(e) => setFormData({ 
                ...formData, 
                startup: { 
                  ...formData.startup, 
                  userEditable: e.target.checked 
                } 
              })}
              className="text-xs"
            />
            <span className="text-xs">User Editable</span>
          </label>
        </div>
        
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">Ready Regex (detects when server is online)</label>
          <input
            type="text"
            value={formData.startup.readyRegex || ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              startup: { 
                ...formData.startup, 
                readyRegex: e.target.value 
              } 
            })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
            placeholder="e.g., Done \(.*\)!"
          />
        </div>
        
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">Stop Command (gracefully stops the server)</label>
          <input
            type="text"
            value={formData.startup.stopCommand || ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              startup: { 
                ...formData.startup, 
                stopCommand: e.target.value 
              } 
            })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
            placeholder="e.g., stop"
          />
        </div>
      </div>

      {/* Environment Variables */}
      <EnvironmentVariableForm 
        variables={formData.environmentVariables}
        onChange={(variables) => setFormData({ ...formData, environmentVariables: variables })}
      />

      {/* Config Files */}
      <ConfigFilesForm
        files={formData.configFiles}
        onChange={(files) => setFormData({ ...formData, configFiles: files })}
      />

      {/* Install Script */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Install Script Details</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={formData.installScript.dockerImage}
            onChange={(e) => setFormData({ 
              ...formData, 
              installScript: { ...formData.installScript, dockerImage: e.target.value } 
            })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
            placeholder="Install Docker Image"
            required
          />
          <input
            type="text"
            value={formData.installScript.entrypoint}
            onChange={(e) => setFormData({ 
              ...formData, 
              installScript: { ...formData.installScript, entrypoint: e.target.value } 
            })}
            className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-md"
            placeholder="Entrypoint (default: bash)"
            defaultValue="bash"
          />
        </div>
        <textarea
          value={formData.installScript.script}
          onChange={(e) => setFormData({ 
            ...formData, 
            installScript: { ...formData.installScript, script: e.target.value } 
          })}
          className="mt-2 block w-full px-3 py-2 text-xs border border-gray-200 rounded-md font-mono"
          placeholder="Install script commands..."
          rows={4}
          required
        />
      </div>

      {/* V3: Features */}
      <FeaturesForm
        features={formData.features}
        onChange={(features) => setFormData({ ...formData, features: features })}
      />

      {/* V3: Metadata */}
      <MetaForm
        meta={formData.meta}
        onChange={(meta) => setFormData({ ...formData, meta: meta })}
      />

      {/* Cargo Containers Section */}
      {type === 'edit' && selectedUnit?.id && (
        <div className="pt-4 border-t border-gray-100">
          <ContainerList 
            unitId={selectedUnit.id} 
            assignedContainers={assignedContainers} 
            onRefresh={() => fetchUnitContainers(selectedUnit.id!)} 
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          type="submit"
          className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
        >
          {type === 'create' ? 'Create Unit' : 'Update Unit'}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(type === 'edit' ? 'view' : 'list');
            resetForm();
          }}
          className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  // V3: Updated unit details view with new fields
  const renderUnitDetails = () => {
    if (!selectedUnit) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setView('list');
                setSelectedUnit(null);
              }}
              className="flex items-center text-gray-600 hover:bg-gray-100 p-2 cursor-pointer rounded-md transition hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedUnit.name}</h2>
              <p className="text-xs text-gray-500">{selectedUnit.shortName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                // V3: Update form data with all v3 fields
                setFormData({
                  name: selectedUnit.name,
                  shortName: selectedUnit.shortName,
                  description: selectedUnit.description,
                  dockerImages: selectedUnit.dockerImages || [{ image: selectedUnit.dockerImage, displayName: 'Default Image' }],
                  defaultDockerImage: selectedUnit.defaultDockerImage || selectedUnit.dockerImage,
                  dockerImage: selectedUnit.dockerImage,
                  defaultStartupCommand: selectedUnit.defaultStartupCommand,
                  configFiles: selectedUnit.configFiles || [],
                  environmentVariables: selectedUnit.environmentVariables || [],
                  installScript: selectedUnit.installScript,
                  startup: selectedUnit.startup,
                  features: selectedUnit.features || [],
                  meta: selectedUnit.meta || { version: 'argon/unit:v3' }
                });
                setView('edit');
              }}
              className="flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => handleDelete(selectedUnit.id!)}
              className="flex items-center px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </button>
            <button
              onClick={() => handleExport(selectedUnit)}
              className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Export
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md shadow-xs p-6 space-y-4">
          <div>
            <div className="text-xs text-gray-500">Description</div>
            <div className="text-sm mt-1">{selectedUnit.description}</div>
          </div>

          {/* V3: Docker Images Section */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Docker Images</div>
            {selectedUnit.dockerImages && selectedUnit.dockerImages.length > 0 ? (
              <div className="space-y-2">
                {selectedUnit.dockerImages.map((image, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border border-gray-100 rounded">
                    <div className="flex items-center space-x-3">
                      <TagIcon className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium">{image.displayName}</div>
                        <div className="text-xs font-mono text-gray-500">{image.image}</div>
                      </div>
                    </div>
                    {selectedUnit.defaultDockerImage === image.image && (
                      <span className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-full">Default</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center p-2 border border-gray-100 rounded">
                <TagIcon className="w-4 h-4 text-gray-400 mr-3" />
                <div className="text-sm font-mono">{selectedUnit.dockerImage}</div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Startup Configuration</div>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500">Default Startup Command</div>
                <div className="text-sm font-mono mt-1 break-all">{selectedUnit.defaultStartupCommand}</div>
              </div>
              
              {/* V3: Enhanced startup details */}
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <div className="text-xs text-gray-500">User Editable</div>
                  <div className="text-sm mt-1">
                    {selectedUnit.startup?.userEditable ? "Yes" : "No"}
                  </div>
                </div>
                {selectedUnit.startup?.readyRegex && (
                  <div>
                    <div className="text-xs text-gray-500">Ready Detection</div>
                    <div className="text-sm font-mono mt-1 break-all">{selectedUnit.startup.readyRegex}</div>
                  </div>
                )}
                {selectedUnit.startup?.stopCommand && (
                  <div>
                    <div className="text-xs text-gray-500">Stop Command</div>
                    <div className="text-sm font-mono mt-1">{selectedUnit.startup.stopCommand}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Environment Variables</div>
            {selectedUnit.environmentVariables.length > 0 ? (
              <div className="space-y-3">
                {selectedUnit.environmentVariables.map((variable, index) => (
                  <div key={index} className="border border-gray-100 rounded p-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Name</div>
                        <div className="text-sm font-mono mt-1">{variable.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Default Value</div>
                        <div className="text-sm font-mono mt-1">{variable.defaultValue}</div>
                      </div>
                    </div>
                    {variable.description && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500">Description</div>
                        <div className="text-sm mt-1">{variable.description}</div>
                      </div>
                    )}
                    <div className="mt-2 flex space-x-4">
                      <div className="text-xs text-gray-500">
                        {variable.required ? "Required" : "Optional"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {variable.userViewable ? "User Viewable" : "Hidden"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {variable.userEditable ? "User Editable" : "Locked"}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs text-gray-500">Validation Rules</div>
                      <div className="text-sm font-mono mt-1">{variable.rules}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No environment variables defined</div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Configuration Files</div>
            {selectedUnit.configFiles.length > 0 ? (
              <div className="space-y-3">
                {selectedUnit.configFiles.map((file, index) => (
                  <div key={index} className="border border-gray-100 rounded p-3">
                    <div>
                      <div className="text-xs text-gray-500">Path</div>
                      <div className="text-sm font-mono mt-1">{file.path}</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs text-gray-500">Content</div>
                      <pre className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono whitespace-pre-wrap">
                        {file.content}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No configuration files defined</div>
            )}
          </div>

          {/* V3: Features Section */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Features</div>
            {selectedUnit.features && selectedUnit.features.length > 0 ? (
              <div className="space-y-3">
                {selectedUnit.features.map((feature, index) => (
                  <div key={index} className="border border-gray-100 rounded p-3">
                    <div className="flex items-start">
                      {feature.iconPath && (
                        <div className="mr-3">
                          <img src={feature.iconPath} alt={feature.name} className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{feature.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{feature.description}</div>
                        <div className="mt-2 flex space-x-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            feature.type === 'required' 
                              ? 'bg-orange-50 text-orange-700' 
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {feature.type === 'required' ? 'Required' : 'Optional'}
                          </span>
                          
                          {feature.uiData && (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {feature.uiData.component} component
                            </span>
                          )}
                        </div>
                        
                        {feature.uiData?.props && (
                          <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            <div className="font-medium mb-1">Component Properties:</div>
                            <ul className="list-disc pl-4 space-y-1">
                              {Object.entries(feature.uiData.props).map(([key, value]) => (
                                <li key={key}>
                                  <span className="font-medium">{key}:</span> {
                                    typeof value === 'object' 
                                      ? JSON.stringify(value) 
                                      : String(value)
                                  }
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No features defined</div>
            )}
          </div>

          {/* V3: Metadata Section */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Metadata</div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Version</div>
                  <div className="text-sm font-mono mt-1">
                    {selectedUnit.meta?.version || 'argon/unit:v3'}
                  </div>
                </div>
                {selectedUnit.meta?.author && (
                  <div>
                    <div className="text-xs text-gray-500">Author</div>
                    <div className="text-sm mt-1">{selectedUnit.meta.author}</div>
                  </div>
                )}
              </div>
              
              {(selectedUnit.meta?.website || selectedUnit.meta?.supportUrl) && (
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {selectedUnit.meta?.website && (
                    <div>
                      <div className="text-xs text-gray-500">Website</div>
                      <a 
                        href={selectedUnit.meta.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                      >
                        {selectedUnit.meta.website}
                      </a>
                    </div>
                  )}
                  {selectedUnit.meta?.supportUrl && (
                    <div>
                      <div className="text-xs text-gray-500">Support URL</div>
                      <a 
                        href={selectedUnit.meta.supportUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                      >
                        {selectedUnit.meta.supportUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cargo Containers Section */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Cargo Containers</div>
            <ContainerList 
              unitId={selectedUnit.id} 
              assignedContainers={assignedContainers} 
              onRefresh={() => fetchUnitContainers(selectedUnit.id!)} 
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-900 mb-3">Install Script</div>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500">Docker Image</div>
                <div className="text-sm font-mono mt-1">{selectedUnit.installScript.dockerImage}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Entrypoint</div>
                <div className="text-sm font-mono mt-1">{selectedUnit.installScript.entrypoint}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Script</div>
                <pre className="mt-2 p-3 bg-gray-50 rounded-md text-xs font-mono overflow-auto">
                  {selectedUnit.installScript.script}
                </pre>
              </div>
            </div>
          </div>

          {selectedUnit.createdAt && selectedUnit.updatedAt && (
            <div className="pt-4 border-t border-gray-100 grid grid-cols-2">
              <div>
                <div className="text-xs text-gray-500">Created At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedUnit.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Updated At</div>
                <div className="text-sm mt-1">
                  {new Date(selectedUnit.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Main render
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminBar />
      <div className="p-6">
        {view === 'list' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Units</h1>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  id="importFile"
                  className="hidden"
                  accept=".json"
                  onChange={handleImportFile}
                />
                <button
                  onClick={() => document.getElementById('importFile')?.click()}
                  className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Import Unit
                </button>
                <button
                  onClick={() => document.getElementById('importEgg')?.click()}
                  className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Import Pterodactyl Egg
                </button>
                <input
                  type="file"
                  id="importEgg"
                  className="hidden"
                  accept=".json"
                  onChange={handleImportEgg}
                />
                <button
                  onClick={() => setView('create')}
                  className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
                >
                  Create Unit
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {units.map((unit) => (
                <div
                  key={unit.id}
                  className="bg-white border border-gray-200 rounded-md shadow-xs cursor-pointer hover:border-gray-300"
                  onClick={() => {
                    setSelectedUnit(unit);
                    setView('view');
                  }}
                >
                  <div className="px-6 h-20 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{unit.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {unit.shortName} • {
                          unit.meta?.version === 'argon/unit:v3' 
                            ? (
                              <>
                                {unit.dockerImages && unit.dockerImages.length > 1
                                  ? `${unit.dockerImages.length} images`
                                  : unit.dockerImage
                                }
                                {' • '}
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-xs">Unit v3</span>
                              </>
                            )
                            : unit.dockerImage
                        }
                      </div>
                    </div>
                    <div className="flex items-center">
                      {unit.features && unit.features.length > 0 && (
                        <div className="mr-3 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                          {unit.features.length} Features
                        </div>
                      )}
                      <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}

              {units.length === 0 && (
                <div className="text-center py-6 bg-white rounded-md border border-gray-200">
                  <p className="text-xs text-gray-500">No units found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'create' && renderUnitForm('create')}
        {view === 'edit' && renderUnitForm('edit')}
        {view === 'view' && renderUnitDetails()}
      </div>
    </div>
  );
};

export default AdminUnitsPage;