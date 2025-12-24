import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, X, Sparkles, Flame, Zap } from "lucide-react";
import { 
  shenzhenClusters, 
  heatConfig, 
  type District, 
  type DistrictCluster 
} from "@shared/districts";

interface DistrictChipProps {
  district: District;
  selected: boolean;
  onSelect: (district: District) => void;
  showHeat?: boolean;
}

function HeatIcon({ iconName, className }: { iconName: 'flame' | 'zap' | 'none'; className?: string }) {
  if (iconName === 'flame') return <Flame className={`h-3 w-3 ${className}`} />;
  if (iconName === 'zap') return <Zap className={`h-3 w-3 ${className}`} />;
  return null;
}

function DistrictChip({ district, selected, onSelect, showHeat = true }: DistrictChipProps) {
  const heat = heatConfig[district.heat];
  
  return (
    <button
      onClick={() => onSelect(district)}
      className={`
        inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium
        transition-all border-2
        ${selected 
          ? 'bg-primary text-primary-foreground border-primary' 
          : 'bg-background border-border hover-elevate'
        }
      `}
      data-testid={`chip-district-${district.id}`}
    >
      <span>{district.shortName || district.name}</span>
      {showHeat && heat.iconName !== 'none' && (
        <HeatIcon iconName={heat.iconName} className={heat.color} />
      )}
    </button>
  );
}

interface SingleSelectDistrictSelectorProps {
  mode: 'single';
  value: string | null;
  onChange: (districtId: string) => void;
  showClusterTabs?: boolean;
}

interface MultiSelectDistrictSelectorProps {
  mode: 'multi';
  value: string[];
  onChange: (districtIds: string[]) => void;
  showSuccessRate?: boolean;
  maxSelections?: number;
}

type DistrictSelectorProps = SingleSelectDistrictSelectorProps | MultiSelectDistrictSelectorProps;

export function DistrictSelector(props: DistrictSelectorProps) {
  const [expandedClusters, setExpandedClusters] = useState<string[]>(['nanshan']);
  
  const isSelected = (districtId: string) => {
    if (props.mode === 'single') {
      return props.value === districtId;
    }
    return props.value.includes(districtId);
  };

  const handleSelect = (district: District) => {
    if (props.mode === 'single') {
      props.onChange(district.id);
    } else {
      const currentValue = props.value;
      if (currentValue.includes(district.id)) {
        props.onChange(currentValue.filter(id => id !== district.id));
      } else {
        if (props.maxSelections && currentValue.length >= props.maxSelections) {
          return;
        }
        props.onChange([...currentValue, district.id]);
      }
    }
  };

  const toggleCluster = (clusterId: string) => {
    setExpandedClusters(prev => 
      prev.includes(clusterId) 
        ? prev.filter(id => id !== clusterId)
        : [...prev, clusterId]
    );
  };

  const removeSelection = (districtId: string) => {
    if (props.mode === 'multi') {
      props.onChange(props.value.filter(id => id !== districtId));
    }
  };

  const getSelectedDistricts = (): District[] => {
    if (props.mode === 'single') {
      const district = shenzhenClusters
        .flatMap(c => c.districts)
        .find(d => d.id === props.value);
      return district ? [district] : [];
    }
    return shenzhenClusters
      .flatMap(c => c.districts)
      .filter(d => props.value.includes(d.id));
  };

  if (props.mode === 'single') {
    return (
      <SingleSelectView 
        clusters={shenzhenClusters}
        selectedId={props.value}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <div className="space-y-4">
      {props.value.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">已选择：</div>
          <div className="flex flex-wrap gap-2">
            {getSelectedDistricts().map(district => (
              <Badge 
                key={district.id} 
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                {district.name}
                <button
                  onClick={() => removeSelection(district.id)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                  data-testid={`button-remove-${district.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {shenzhenClusters.map(cluster => (
          <ClusterSection
            key={cluster.id}
            cluster={cluster}
            expanded={expandedClusters.includes(cluster.id)}
            onToggle={() => toggleCluster(cluster.id)}
            isSelected={isSelected}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {props.showSuccessRate && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary">
            多选2-3个商圈，成局率提升42%
          </span>
        </div>
      )}
    </div>
  );
}

interface SingleSelectViewProps {
  clusters: DistrictCluster[];
  selectedId: string | null;
  onSelect: (district: District) => void;
}

function SingleSelectView({ clusters, selectedId, onSelect }: SingleSelectViewProps) {
  const [activeCluster, setActiveCluster] = useState(clusters[0]?.id || '');
  
  const currentCluster = clusters.find(c => c.id === activeCluster);
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {clusters.map(cluster => (
          <button
            key={cluster.id}
            onClick={() => setActiveCluster(cluster.id)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
              transition-all border-2
              ${activeCluster === cluster.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover-elevate'
              }
            `}
            data-testid={`tab-cluster-${cluster.id}`}
          >
            {cluster.name}
          </button>
        ))}
      </div>

      {currentCluster && (
        <div className="flex flex-wrap gap-2">
          {currentCluster.districts.map(district => (
            <DistrictChip
              key={district.id}
              district={district}
              selected={selectedId === district.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ClusterSectionProps {
  cluster: DistrictCluster;
  expanded: boolean;
  onToggle: () => void;
  isSelected: (id: string) => boolean;
  onSelect: (district: District) => void;
}

function ClusterSection({ cluster, expanded, onToggle, isSelected, onSelect }: ClusterSectionProps) {
  const selectedCount = cluster.districts.filter(d => isSelected(d.id)).length;
  
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover-elevate">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">{cluster.name}</span>
          {selectedCount > 0 && (
            <Badge variant="default" className="text-xs">
              {selectedCount}
            </Badge>
          )}
        </div>
        {!expanded && (
          <span className="text-xs text-muted-foreground">查看更多</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 pl-6">
        <div className="flex flex-wrap gap-2">
          {cluster.districts.map(district => (
            <DistrictChip
              key={district.id}
              district={district}
              selected={isSelected(district.id)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default DistrictSelector;
