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
    source: "https://gvb.nl/en/travel-information/stops-and-timetable (GVB timetable APIs via browser automation)",
    lastUpdated: "2026-02-22T15:55:22.417Z",
    refreshCadence: "weekly",
  },
  routes: [
    {
      id: "f1",
      frequency: "Every 4 min",
      duration: 5,
      operatingHours: "24/7",
      status: "active",
    },
    {
      id: "f2",
      frequency: "Every 6 min",
      duration: 5,
      operatingHours: "06:26 - 23:50",
      status: "active",
    },
    {
      id: "f3",
      frequency: "Every 15-30 min",
      duration: 14,
      operatingHours: "06:45 - 03:30",
      status: "active",
    },
    {
      id: "f4",
      frequency: "Every 7-15 min",
      duration: 6,
      operatingHours: "06:38 - 22:38",
      status: "active",
    },
    {
      id: "f5",
      frequency: "Every 20 min",
      duration: 6,
      operatingHours: "06:20 - 22:20",
      status: "active",
    },
    {
      id: "f6",
      frequency: "Every 30 min",
      duration: 6,
      operatingHours: "07:00 - 23:30",
      status: "active",
    },
  ],
};

export default ferryScheduleData;
