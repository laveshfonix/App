import type {AnchorPosition} from '@styles/index';

import type {ComponentRef, RefObject} from 'react';
import type {View} from 'react-native';

type UseFollowAnchor = (anchorRef: RefObject<ComponentRef<typeof View> | HTMLDivElement | null>, anchorPosition: AnchorPosition, isActive: boolean) => AnchorPosition;

export default UseFollowAnchor;
