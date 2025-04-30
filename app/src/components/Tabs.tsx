import React, { useState, useRef, useEffect, useCallback } from 'react';
interface TabsProps {
  tabs: {
    id: string;
    label: React.ReactNode;
  }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const SmoothTabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  // State for the indicator
  const [indicatorStyle, setIndicatorStyle] = useState({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    opacity: 0,
  });
  
  // Refs for tab buttons
  const tabRefsMap = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  
  // Set ref for tab button
  const setTabRef = useCallback((id: string, element: HTMLButtonElement | null) => {
    tabRefsMap.current[id] = element;
  }, []);
  
  // Update indicator position when active tab changes
  useEffect(() => {
    const updateIndicator = () => {
      const tabElement = tabRefsMap.current[activeTab];
      if (!tabElement || !tabsContainerRef.current) return;
      
      const rect = tabElement.getBoundingClientRect();
      const containerRect = tabsContainerRef.current.getBoundingClientRect();
      
      const offsetLeft = rect.left - containerRect.left;
      
      setIndicatorStyle({
        width: rect.width,
        height: rect.height,
        top: 0,
        left: offsetLeft,
        opacity: 1,
      });
    };
    
    // Use requestAnimationFrame for smooth animation
    const animationFrame = requestAnimationFrame(updateIndicator);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeTab]);
  
  // TabButton component with ref handling
  const TabButton: React.FC<{
    id: string;
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }> = ({ id, isActive, onClick, children }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    
    useEffect(() => {
      if (buttonRef.current) {
        setTabRef(id, buttonRef.current);
      }
      
      return () => {
        setTabRef(id, null);
      };
    }, [id]);
    
    return (
      <button
        ref={buttonRef}
        onClick={onClick}
        className={`tab-button px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
          isActive
            ? 'text-gray-800 border border-transparent'
            : 'text-gray-500 border border-transparent hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        {children}
      </button>
    );
  };
  
  return (
    <div ref={tabsContainerRef} className="inline-flex p-1 space-x-1 bg-gray-100 rounded-lg relative">
      {/* Animated indicator */}
      <div 
        className="absolute transform transition-all duration-200 ease-spring bg-white rounded-md shadow-xs border border-gray-200/50 z-0"
        style={{
          width: `${indicatorStyle.width}px`,
          height: `${indicatorStyle.height}px`,
          top: `${indicatorStyle.top}px`,
          left: `${indicatorStyle.left}px`,
          opacity: indicatorStyle.opacity,
          transitionDelay: '30ms',
        }}
      />
      
      {/* Tab buttons */}
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          id={tab.id}
          isActive={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </TabButton>
      ))}
    </div>
  );
};