import {act, render, renderHook} from '@testing-library/react-native';

import type {PopoverMenuItem} from '@components/PopoverMenu';
import PopoverMenu from '@components/PopoverMenu';

import usePopoverPosition from '@hooks/usePopoverPosition';

import type {AnchorPosition} from '@styles/index';

import CONST from '@src/CONST';

import type {PropsWithChildren, RefObject} from 'react';

import React from 'react';

type MockMeasuredPopoverProps = PropsWithChildren<{anchorPosition: AnchorPosition}>;

const mockPopoverWithMeasuredContent = jest.fn<void, [MockMeasuredPopoverProps]>();

jest.mock('@components/PopoverWithMeasuredContent', () => ({
    __esModule: true,
    default: (props: MockMeasuredPopoverProps) => {
        mockPopoverWithMeasuredContent(props);
        return props.children;
    },
}));

// Jest resolves the native file, which keeps the given position, so load the web hook that follows the anchor
jest.mock('@components/PopoverMenu/useFollowAnchor', () => jest.requireActual<{default: unknown}>('@components/PopoverMenu/useFollowAnchor/index.ts'));

jest.mock('@hooks/useResponsiveLayout', () => ({
    __esModule: true,
    default: () => ({isSmallScreenWidth: false, shouldUseNarrowLayout: false, isInLandscapeMode: false, isMediumScreenWidth: false, isLargeScreenWidth: true}),
}));

const MENU_ITEMS: PopoverMenuItem[] = [{text: 'Delete'}];

// Animation frames run only when a test calls nextFrame(), one frame at a time
let pendingFrames = new Map<number, FrameRequestCallback>();
let lastFrameID = 0;
jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
    lastFrameID += 1;
    pendingFrames.set(lastFrameID, callback);
    return lastFrameID;
});
jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((frameID) => {
    if (frameID === null || frameID === undefined) {
        return;
    }
    pendingFrames.delete(frameID);
});

/** A real DOM element standing in for the ⋮ button, whose position on screen can be changed between frames */
function createAnchor(x: number, y: number) {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    let box = {x, y, width: 20, height: 40};
    anchor.getBoundingClientRect = () => ({...box, top: box.y, left: box.x, right: box.x + box.width, bottom: box.y + box.height, toJSON: () => box});
    const anchorRef: RefObject<HTMLDivElement | null> = {current: anchor};
    return {
        anchorRef,
        moveTo: (nextX: number, nextY: number) => {
            box = {...box, x: nextX, y: nextY};
        },
        hide: () => {
            box = {...box, width: 0, height: 0};
        },
    };
}

function getLastAnchorPosition() {
    return mockPopoverWithMeasuredContent.mock.calls.at(-1)?.[0].anchorPosition;
}

function nextFrame() {
    act(() => {
        const frames = pendingFrames;
        pendingFrames = new Map();
        for (const callback of frames.values()) {
            callback(0);
        }
    });
}

describe('PopoverMenu follows its anchor on web', () => {
    beforeEach(() => {
        mockPopoverWithMeasuredContent.mockClear();
        pendingFrames = new Map();
        document.body.innerHTML = '';
    });

    it('moves the open menu by as much as its anchor moved after the menu opened', () => {
        // Given an open menu placed under its ⋮ button, measured where the button was when it opened
        const {anchorRef, moveTo} = createAnchor(913, 428);
        render(
            <PopoverMenu
                isVisible
                menuItems={MENU_ITEMS}
                onClose={() => {}}
                anchorPosition={{horizontal: 933, vertical: 476}}
                anchorRef={anchorRef}
            />,
        );
        nextFrame();
        expect(getLastAnchorPosition()).toEqual({horizontal: 933, vertical: 476});

        // When the button moves 150px to the right without the window size changing again, as it does when its list row gets the new
        // width a few frames after the window is resized
        moveTo(1063, 428);
        nextFrame();

        // Then the menu is shifted by the same 150px, so it stays under the button
        expect(getLastAnchorPosition()).toEqual({horizontal: 1083, vertical: 476});
    });

    it('stops following once the menu is hidden', () => {
        // Given an open menu
        const {anchorRef, moveTo} = createAnchor(913, 428);
        const anchorPosition = {horizontal: 933, vertical: 476};
        const {rerender} = render(
            <PopoverMenu
                isVisible
                menuItems={MENU_ITEMS}
                onClose={() => {}}
                anchorPosition={anchorPosition}
                anchorRef={anchorRef}
            />,
        );
        nextFrame();

        // When the menu closes and its anchor moves afterwards
        rerender(
            <PopoverMenu
                isVisible={false}
                menuItems={MENU_ITEMS}
                onClose={() => {}}
                anchorPosition={anchorPosition}
                anchorRef={anchorRef}
            />,
        );
        moveTo(1063, 428);
        nextFrame();

        // Then the closed menu keeps the position its caller gave, nothing is read for a menu that isn't shown
        expect(getLastAnchorPosition()).toEqual(anchorPosition);
    });

    it('measures the movement from the new coordinates when the caller gives the menu a new position', () => {
        // Given an open menu whose anchor already moved by 150px
        const {anchorRef, moveTo} = createAnchor(913, 428);
        const {rerender} = render(
            <PopoverMenu
                isVisible
                menuItems={MENU_ITEMS}
                onClose={() => {}}
                anchorPosition={{horizontal: 933, vertical: 476}}
                anchorRef={anchorRef}
            />,
        );
        nextFrame();
        moveTo(1063, 428);
        nextFrame();

        // When the caller measures the button again and passes those coordinates, then the button moves 10px more
        rerender(
            <PopoverMenu
                isVisible
                menuItems={MENU_ITEMS}
                onClose={() => {}}
                anchorPosition={{horizontal: 1083, vertical: 476}}
                anchorRef={anchorRef}
            />,
        );
        nextFrame();
        expect(getLastAnchorPosition()).toEqual({horizontal: 1083, vertical: 476});
        moveTo(1073, 428);
        nextFrame();

        // Then only the 10px since the new coordinates are added, the earlier 150px isn't counted twice
        expect(getLastAnchorPosition()).toEqual({horizontal: 1093, vertical: 476});
    });

    it('follows from where the anchor was measured, even if it moved before the menu got the position', async () => {
        // Given a position measured from the ⋮ button while it was at x=913
        const {anchorRef, moveTo} = createAnchor(913, 428);
        Object.assign(anchorRef.current ?? {}, {
            measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(913, 428, 20, 40),
        });
        const {result} = renderHook(() => usePopoverPosition());
        let measuredPosition: AnchorPosition = {horizontal: 0, vertical: 0};
        await act(async () => {
            measuredPosition = await result.current.calculatePopoverPosition(anchorRef, {
                horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP,
            });
        });

        // When the button moves 150px before the menu receives that position, as when the page is still laying out after a resize
        moveTo(1063, 428);
        render(
            <PopoverMenu
                isVisible
                menuItems={MENU_ITEMS}
                onClose={() => {}}
                anchorPosition={measuredPosition}
                anchorRef={anchorRef}
            />,
        );
        nextFrame();

        // Then the menu counts that move too, instead of starting from the button's new place
        expect(getLastAnchorPosition()).toEqual({...measuredPosition, horizontal: measuredPosition.horizontal + 150});
    });

    it('keeps the last position while the anchor has no box', () => {
        // Given an open menu whose anchor moved by 150px
        const {anchorRef, moveTo, hide} = createAnchor(913, 428);
        render(
            <PopoverMenu
                isVisible
                menuItems={MENU_ITEMS}
                onClose={() => {}}
                anchorPosition={{horizontal: 933, vertical: 476}}
                anchorRef={anchorRef}
            />,
        );
        nextFrame();
        moveTo(1063, 428);
        nextFrame();

        // When the anchor is hidden, for example while another layout is shown
        hide();
        nextFrame();

        // Then the menu stays where it last was instead of jumping to the hidden anchor's empty box
        expect(getLastAnchorPosition()).toEqual({horizontal: 1083, vertical: 476});
    });
});
