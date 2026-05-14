# MyGolfScore - Project TODO

## Phase 1: Database & Data Model
- [x] Design data schema for scorecards, golf courses, holes, analysis reports
- [x] Create Drizzle ORM schema (users, scorecards, scorecard_holes, golf_courses, golf_course_holes, analysis_reports)
- [x] Generate and apply database migrations

## Phase 2: Backend Implementation
- [x] Implement scorecard upload handler (S3 storage)
- [x] Implement OCR/LLM-based data extraction procedure
- [x] Implement scorecard review/update procedure
- [x] Implement golf course and hole matching procedures
- [x] Implement dashboard analytics procedures (KPI, charts)
- [x] Implement AI Analyst report generation procedure
- [ ] Write vitest tests for all backend procedures

## Phase 3: Frontend - Layout & Navigation
- [x] Customize DashboardLayout for MyGolfScore design
- [x] Set up global theme (Deep Green #1B4332, Charcoal, Off-white)
- [x] Configure Pretendard font globally
- [x] Create sidebar navigation structure
- [x] Implement auth state management

## Phase 4: Frontend - Core Pages
- [x] Create Dashboard page (KPI cards, charts, period filters)
- [x] Create Scorecard Upload page
- [ ] Create Scorecard Review page (original image + extracted data side-by-side)
- [x] Create Scorecard Detail page (hole-by-hole table with color coding)
- [x] Create Scorecard List page
- [ ] Create Golf Course/Hole Management page
- [x] Create AI Analyst page

## Phase 5: Frontend - Features
- [x] Implement file upload with drag-and-drop
- [ ] Implement image preview and OCR result display
- [ ] Implement scorecard data editing UI
- [ ] Implement golf course/hole matching UI
- [x] Implement dashboard charts (Recharts)
- [x] Implement period filters
- [x] Implement AI Analyst report display and save

## Phase 6: Integration & Polish
- [ ] Test end-to-end workflows
- [ ] Fix bugs and edge cases
- [ ] Optimize performance
- [ ] Add loading states and error handling
- [ ] Final UI polish and accessibility review

## Bug Fixes
- [x] Fix Home page render-time navigation error (use useEffect instead)

## Completed Items
