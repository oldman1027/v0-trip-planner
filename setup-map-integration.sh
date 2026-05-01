#!/bin/bash
set -e
echo "🚀 Starting Tripletto Map Integration Setup..."
echo ""
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
PROJECT_DIR=~/v0-trip-planner
cd "$PROJECT_DIR"
echo -e "${BLUE}📁 Working directory: $(pwd)${NC}"
echo ""

echo -e "${YELLOW}Step 1/5: Installing dependencies...${NC}"
pnpm add @googlemaps/js-api-loader 2>&1 | tail -3
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

mkdir -p src/lib src/components

echo -e "${YELLOW}Step 2/5: Creating map utilities...${NC}"
cat > src/lib/map-utils.ts << 'EOF'
export const DAY_COLORS = [
  '#FF9999','#FFB366','#FFEB99','#99FF99','#99D9FF',
  '#CC99FF','#FF99CC','#99FFCC','#FFD699',
] as const;
export function getDayColor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length] || DAY_COLORS[0];
}
export function calculateDayNumber(activityDate: string | Date, tripStartDate: string | Date): number {
  const activity = new Date(activityDate); const tripStart = new Date(tripStartDate);
  activity.setHours(0,0,0,0); tripStart.setHours(0,0,0,0);
  return Math.floor((activity.getTime() - tripStart.getTime()) / 86400000) + 1;
}
EOF
echo -e "${GREEN}✓ Created src/lib/map-utils.ts${NC}"
echo ""

echo -e "${YELLOW}Step 3/5: Creating TripMap component stub...${NC}"
echo "// Stub — real TripMap is at components/trip/overview/trip-map.tsx" > src/components/TripMap.tsx
echo -e "${GREEN}✓ Created src/components/TripMap.tsx${NC}"
echo ""

echo -e "${YELLOW}Step 4/5: Checking for existing CalendarView...${NC}"
CALENDAR_VIEW_FILE="components/trip/itinerary/calendar-view.tsx"
if [ -f "$CALENDAR_VIEW_FILE" ]; then
  cp "$CALENDAR_VIEW_FILE" "${CALENDAR_VIEW_FILE}.backup"
  echo -e "${GREEN}✓ Backed up to: ${CALENDAR_VIEW_FILE}.backup${NC}"
else
  echo -e "${YELLOW}⚠️  CalendarView not found at expected path${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5/5: Creating integration template...${NC}"
echo "// Template created — see CalendarView integration below" > src/components/CalendarView.TEMPLATE.tsx
echo -e "${GREEN}✓ Template noted${NC}"
echo ""

echo -e "${GREEN}✅ Setup scaffold complete.${NC}"
