import {act, fireEvent, render, screen} from '@testing-library/react-native';

import ThreeDotsMenu from '@components/ThreeDotsMenu';

import getPlatform from '@libs/getPlatform';

import type {AnchorPosition} from '@styles/index';

import CONST from '@src/CONST';

import type {PropsWithChildren} from 'react';

import React from 'react';

type MockPopoverMenuProps = {anchorPosition: AnchorPosition; isVisible: boolean};

const mockPopoverMenu = jest.fn<void, [MockPopoverMenuProps]>();
const mockCalculatePopoverPosition = jest.fn<Promise<AnchorPosition>, []>();
let mockIsSmallScreenWidth = false;
let mockWindowDimensions = {windowWidth: 1000, windowHeight: 800};

jest.mock('@components/PopoverMenu', () => ({
    __esModule: true,
    default: (props: MockPopoverMenuProps) => {
        mockPopoverMenu(props);
        return null;
    },
}));
jest.mock('@components/Tooltip/PopoverAnchorTooltip', () => ({
    __esModule: true,
    default: ({children}: PropsWithChildren) => children,
}));
jest.mock('@components/Icon', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('@libs/getPlatform');
jest.mock('@hooks/useResponsiveLayout', () => ({
    __esModule: true,
    default: () => ({isSmallScreenWidth: mockIsSmallScreenWidth, shouldUseNarrowLayout: mockIsSmallScreenWidth}),
}));
jest.mock('@hooks/useWindowDimensions', () => ({
    __esModule: true,
    default: () => mockWindowDimensions,
}));
jest.mock('@hooks/usePopoverPosition', () => ({
    __esModule: true,
    default: () => ({calculatePopoverPosition: mockCalculatePopoverPosition}),
}));

const mockGetPlatform = jest.mocked(getPlatform);
const MENU_ITEMS = [{text: 'Delete'}];
const ANCHOR_ALIGNMENT = {horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT, vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP};
const BUTTON_TEST_ID = 'ThreeDotsMenuButton';

function renderMenu() {
    return render(
        <ThreeDotsMenu
            shouldSelfPosition
            menuItems={MENU_ITEMS}
            anchorAlignment={ANCHOR_ALIGNMENT}
            testID={BUTTON_TEST_ID}
        />,
    );
}

async function openMenu() {
    fireEvent.press(screen.getByTestId(BUTTON_TEST_ID));
    await act(async () => {
        await Promise.resolve();
    });
}

async function flushMeasurements() {
    await act(async () => {
        await Promise.resolve();
    });
}

function getLastAnchorPosition() {
    return mockPopoverMenu.mock.calls.at(-1)?.[0].anchorPosition;
}

describe('ThreeDotsMenu measuring its button again', () => {
    beforeEach(() => {
        mockPopoverMenu.mockClear();
        mockCalculatePopoverPosition.mockReset();
        mockIsSmallScreenWidth = false;
        mockWindowDimensions = {windowWidth: 1000, windowHeight: 800};
    });

    it('measures again on web when the open menu switches from a bottom sheet to a popover', async () => {
        // Given a menu opened on a small screen, where the position is only a placeholder because the menu is a bottom sheet
        mockGetPlatform.mockReturnValue(CONST.PLATFORM.WEB);
        mockIsSmallScreenWidth = true;
        mockWindowDimensions = {windowWidth: 750, windowHeight: 800};
        mockCalculatePopoverPosition.mockResolvedValue({horizontal: 0, vertical: 0});
        const {rerender} = renderMenu();
        await openMenu();
        expect(getLastAnchorPosition()).toEqual({horizontal: 0, vertical: 0});

        // When the window gets wide enough for the menu to become a popover
        mockIsSmallScreenWidth = false;
        mockWindowDimensions = {windowWidth: 1000, windowHeight: 800};
        mockCalculatePopoverPosition.mockResolvedValue({horizontal: 933, vertical: 476});
        rerender(
            <ThreeDotsMenu
                shouldSelfPosition
                menuItems={MENU_ITEMS}
                anchorAlignment={ANCHOR_ALIGNMENT}
                testID={BUTTON_TEST_ID}
            />,
        );
        await flushMeasurements();

        // Then the button is measured again, so the popover doesn't open from the placeholder position in the top-left corner
        expect(getLastAnchorPosition()).toEqual({horizontal: 933, vertical: 476});
    });

    it('does not measure again on web when only the window size changes, because the open menu follows its button', async () => {
        // Given a menu opened as a popover on web
        mockGetPlatform.mockReturnValue(CONST.PLATFORM.WEB);
        mockCalculatePopoverPosition.mockResolvedValue({horizontal: 933, vertical: 476});
        const {rerender} = renderMenu();
        await openMenu();
        mockCalculatePopoverPosition.mockClear();

        // When the window gets wider but stays wide
        mockWindowDimensions = {windowWidth: 1150, windowHeight: 800};
        rerender(
            <ThreeDotsMenu
                shouldSelfPosition
                menuItems={MENU_ITEMS}
                anchorAlignment={ANCHOR_ALIGNMENT}
                testID={BUTTON_TEST_ID}
            />,
        );
        await flushMeasurements();

        // Then it doesn't measure the button at this moment, when the page hasn't finished laying out and the button hasn't moved yet
        expect(mockCalculatePopoverPosition).not.toHaveBeenCalled();
    });

    it('still measures again on native when the window size changes', async () => {
        // Given a menu opened on native
        mockGetPlatform.mockReturnValue(CONST.PLATFORM.IOS);
        mockCalculatePopoverPosition.mockResolvedValue({horizontal: 933, vertical: 476});
        const {rerender} = renderMenu();
        await openMenu();
        mockCalculatePopoverPosition.mockClear();

        // When the window size changes, for example in split view
        mockWindowDimensions = {windowWidth: 1150, windowHeight: 800};
        rerender(
            <ThreeDotsMenu
                shouldSelfPosition
                menuItems={MENU_ITEMS}
                anchorAlignment={ANCHOR_ALIGNMENT}
                testID={BUTTON_TEST_ID}
            />,
        );
        await flushMeasurements();

        // Then the button is measured again, as native menus don't follow their button
        expect(mockCalculatePopoverPosition).toHaveBeenCalled();
    });
});
