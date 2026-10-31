import type UseFollowAnchor from './types';

/** On native, the menu keeps the position its caller gives it */
const useFollowAnchor: UseFollowAnchor = (anchorRef, anchorPosition) => anchorPosition;

export default useFollowAnchor;
