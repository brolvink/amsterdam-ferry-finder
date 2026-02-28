# Amsterdam Ferry Finder

Fun side project to explore Amsterdam ferries on an interactive map with route and departure details.

Live: https://ferry.bramrolvink.nl

![Amsterdam Ferry Finder screenshot](public/ferry-screenshot.png)

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Leaflet (map)

## Run locally

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```

## Ferry schedule updates

Schedule data lives in `src/data/ferryScheduleData.ts`.

To refresh from GVB:

```sh
npm run update:ferry-schedules
```

The updater uses a fixed source URL:
- `https://gvb.nl/en/travel-information/stops-and-timetable`

It extracts timetable data weekly via GVB's timetable APIs through browser automation (Playwright), then rewrites `src/data/ferryScheduleData.ts`.

GitHub Actions workflow: `.github/workflows/ferry-schedule-refresh.yml` (weekly by default).

## Docker

This repo includes a production-ready `Dockerfile` + `nginx.conf` for serving the built SPA.
