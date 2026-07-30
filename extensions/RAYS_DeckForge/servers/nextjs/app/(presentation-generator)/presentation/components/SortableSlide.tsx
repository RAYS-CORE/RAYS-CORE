import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Slide } from '../../types/slide';
import { useRef } from 'react';
import { SlideThumbnailCard } from './SlideThumbnailCard';
interface SortableSlideProps {
    slide: Slide;
    index: number;
    selectedSlide: number;
    onSlideClick: (index: any) => void;
}

export function SortableSlide({ slide, index, selectedSlide, onSlideClick }: SortableSlideProps) {
    const lastClickTime = useRef(0);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: slide.id || `${slide.index}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleClick = (e: React.MouseEvent) => {
        const now = Date.now();

        // Debounce clicks - only allow one click every 300ms
        if (now - lastClickTime.current < 300) {
            return;
        }

        // Only trigger click if not dragging
        if (!isDragging) {
            lastClickTime.current = now;
            onSlideClick(slide.index);
        }
    };

    return (
        <SlideThumbnailCard
            ref={setNodeRef}
            slide={slide}
            index={index}
            selected={selectedSlide === index}
            style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}
        />
    );
}
