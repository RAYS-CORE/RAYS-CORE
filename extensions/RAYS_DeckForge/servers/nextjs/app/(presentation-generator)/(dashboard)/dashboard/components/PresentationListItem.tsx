import React from 'react';

import { Card, CardContent } from "@/components/ui/card";
import { Presentation } from '../types';

export const PresentationListItem: React.FC<Presentation> = ({
    title,
    date,
    thumbnail,
    type
}) => {
    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div className="relative w-[120px] aspect-video rounded-md overflow-hidden">
                    <img
                        src={thumbnail}
                        alt={title}
                        className="object-cover"
                    />
                </div>

                <div className="flex-1">
                    <h3 className="font-medium">{title}</h3>
                    <div className="text-sm text-muted-foreground">
                        {/* {formatDistanceToNow(new Date(date), { addSuffix: true })} */}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {type === 'video' ? (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 12L9 8V16L15 12Z" fill="currentColor" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 4H20V16H4V4Z" stroke="currentColor" strokeWidth="2" />
                        </svg>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}; 