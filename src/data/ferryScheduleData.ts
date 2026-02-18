export type FerryRouteStatus = "active" | "delayed" | "offline";

export interface FerryScheduleMeta {
  source: string;
  lastUpdated: string;
  refreshCadence: "daily" | "weekly";
}

export interface FerryScheduleEntry {
  id: string;
  frequency: string;
  duration: number;
  operatingHours: string;
  status: FerryRouteStatus;
}

export interface FerryScheduleData {
  meta: FerryScheduleMeta;
  routes: FerryScheduleEntry[];
}

const ferryScheduleData: FerryScheduleData = {
  meta: {
    source: "GVB official timetable (manually curated)",
    lastUpdated: "2026-02-18T00:00:00.000Z",
    refreshCadence: "weekly",
  },
  routes: [
    {
      id: "f1",
      frequency: "Every 5 min",
      duration: 4,
      operatingHours: "24/7",
      status: "active",
    },
    {
      id: "f2",
      frequency: "Every 8 min",
      duration: 5,
      operatingHours: "06:30 - 00:00",
      status: "active",
    },
    {
      id: "f3",
      frequency: "Every 10-30 min",
      duration: 14,
      operatingHours: "07:00 - 02:00",
      status: "active",
    },
    {
      id: "f4",
      frequency: "Every 15 min",
      duration: 6,
      operatingHours: "06:30 - 19:30 (Mon-Fri)",
      status: "active",
    },
    {
      id: "f5",
      frequency: "Every 20 min",
      duration: 6,
      operatingHours: "06:30 - 22:30",
      status: "active",
    },
    {
      id: "f6",
      frequency: "Every 20 min",
      duration: 9,
      operatingHours: "06:30 - 22:30",
      status: "active",
    },
  ],
};

export default ferryScheduleData;
