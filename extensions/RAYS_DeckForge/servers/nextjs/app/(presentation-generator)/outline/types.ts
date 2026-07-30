export interface ChartData {
    seriesTitles: string[];
    label: string;
    values: string[];
    
}

// Configuration for a single chart
export interface ChartConfig {
    id: string;         
    chartTitle: string;     
    type: 'Pie chart' | 'Bar Graph' | 'Line Graph';
    data: ChartData[];
   
   
}

// API Chart Response Type
export interface APIChartResponse {
    id: string | null;
    name: string;
    type: string;
    presentation: string | null;
    postfix: string | null;
    data: {
        categories: string[];
        series: {
            name: string;
            data: number[];
        }[];
    };
}

// Represents a single outline item in the presentation
export interface OutlineItem {
    id: string;         
    slideTitle: string;     
    number: number;     
    charts: ChartConfig[]; 
}


