import {getMeasuredAnchor} from '@hooks/usePopoverPosition';

import {useEffect, useLayoutEffect, useRef, useState} from 'react';

import type UseFollowAnchor from './types';

type Point = {x: number; y: number};

/** How far the anchor has moved since the menu got the anchorPosition with these coordinates */
type FollowedAnchor = {
    horizontal: number;
    vertical: number;
    offset: Point;
};

function getAnchorPoint(anchor: unknown): Point | undefined {
    if (!(anchor instanceof HTMLElement) || !anchor.isConnected) {
        return undefined;
    }
    const rect = anchor.getBoundingClientRect();

    // A hidden anchor has no box to follow, for example while the narrow layout is shown
    if (rect.width === 0 && rect.height === 0) {
        return undefined;
    }
    return {x: rect.x, y: rect.y};
}

/**
 * Keeps an open menu next to the element it was opened from. While the menu is open, the anchor is read once per animation frame, and the
 * menu is shifted by exactly how far the anchor has moved since the menu got its anchorPosition. The anchor can move a few frames after the
 * window size changes, when the navigation cards and list rows receive their new widths, so measuring it once when the size changes isn't enough.
 */
const useFollowAnchor: UseFollowAnchor = (anchorRef, anchorPosition, isActive) => {
    const {horizontal, vertical} = anchorPosition;
    const [followedAnchor, setFollowedAnchor] = useState<FollowedAnchor>();
    const startRef = useRef<{horizontal: number; vertical: number; point: Point}>(undefined);

    const measuredAnchor = getMeasuredAnchor(anchorPosition);
    const measuredElement = measuredAnchor?.element;
    const measuredX = measuredAnchor?.x;
    const measuredY = measuredAnchor?.y;

    // Start from where the anchor was when these coordinates were measured, so a move between that measurement and now isn't lost.
    // Coordinates that weren't measured from this anchor start from where it is now, before the browser paints the menu there.
    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        const point = measuredElement === anchor && measuredX !== undefined && measuredY !== undefined ? {x: measuredX, y: measuredY} : getAnchorPoint(anchor);
        startRef.current = point ? {horizontal, vertical, point} : undefined;
    }, [anchorRef, measuredElement, measuredX, measuredY, horizontal, vertical]);

    useEffect(() => {
        if (!isActive) {
            return;
        }
        let lastFollowedAnchor: FollowedAnchor | undefined;
        let frame = requestAnimationFrame(function followAnchor() {
            const start = startRef.current;
            const point = getAnchorPoint(anchorRef.current);
            if (start && point) {
                const offset = {x: point.x - start.point.x, y: point.y - start.point.y};

                // Only re-render the menu when the anchor actually moved
                if (
                    lastFollowedAnchor?.horizontal !== start.horizontal ||
                    lastFollowedAnchor.vertical !== start.vertical ||
                    lastFollowedAnchor.offset.x !== offset.x ||
                    lastFollowedAnchor.offset.y !== offset.y
                ) {
                    lastFollowedAnchor = {horizontal: start.horizontal, vertical: start.vertical, offset};
                    setFollowedAnchor(lastFollowedAnchor);
                }
            }
            frame = requestAnimationFrame(followAnchor);
        });
        return () => cancelAnimationFrame(frame);
    }, [anchorRef, isActive]);

    if (!isActive || followedAnchor?.horizontal !== horizontal || followedAnchor.vertical !== vertical || (followedAnchor.offset.x === 0 && followedAnchor.offset.y === 0)) {
        return anchorPosition;
    }
    return {...anchorPosition, horizontal: horizontal + followedAnchor.offset.x, vertical: vertical + followedAnchor.offset.y};
};

export default useFollowAnchor;
