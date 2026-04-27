import { Dimensions } from 'react-native';
import { spacing } from '../../theme/colors';

const SCREEN_W = Dimensions.get('window').width;
const CARD_MARGIN = 10; // matches TrendsScreen paddingHorizontal: 10
const CONTENT_PAD = spacing.lg; // 18

// Width inside card content padding — used for bar column sizing
export const TREND_CHART_W = SCREEN_W - CARD_MARGIN * 2 - CONTENT_PAD * 2;

// Full bleed width — chartWrap uses marginHorizontal: -CONTENT_PAD to cancel the padding,
// so the line chart SVG fills the full card inner width
export const TREND_LINE_CHART_W = SCREEN_W - CARD_MARGIN * 2;

export const CARD_BLUR_STYLE = {
  borderRadius: 20,
  overflow: 'hidden' as const,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
};
