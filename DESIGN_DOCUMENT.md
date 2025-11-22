# Project Cost Reporting Application - Design Document

## 1. Application Overview

### 1.1 Purpose
The Project Cost Reporting Application (`com.atg.ppm.postfinrevenue`) is a SAP UI5-based solution designed to manage and report on project costs within ATG's Project Portfolio Management (PPM) system. The application provides comprehensive cost tracking, valuation management, and financial reporting capabilities for construction and project management operations.

### 1.2 Key Business Functions
- **Project Cost Management**: Track actual costs, budgets, and forecasts
- **Financial Reporting**: Generate detailed cost reports with multiple hierarchical views
- **Valuation Tracking**: Monitor cumulative certifications and internal valuations
- **Authorization Control**: Role-based access for Create, Change, and Display operations
- **Multi-Currency Support**: Handle transactions in different currencies (primarily AED)

## 2. System Architecture

### 2.1 Technology Stack
- **Frontend**: SAP UI5 (version 1.120.14+)
- **Backend**: SAP OData V2 Services
- **Data Source**: `Z_UI_PPM_PROJECTCOSTRPT_O2` OData service
- **UI Controls**: SAP Fiori Elements, Smart Forms, Smart Fields
- **Routing**: SAP UI5 Router with pattern-based navigation

### 2.2 Application Structure
```
postfinrevenue/
├── webapp/
│   ├── controller/           # Business Logic Controllers
│   ├── view/                 # XML Views and Fragments
│   ├── model/                # Data Models
│   ├── css/                  # Styling
│   ├── i18n/                 # Internationalization
│   └── localService/         # Mock Data Services
```

## 3. Functional Modules

### 3.1 Core Controllers
1. **App.controller.js** - Base controller with shared functionality
2. **ProjectCostReport.controller.js** - Main selection and navigation
3. **ReportCreate.controller.js** - New report creation
4. **ReportChange.controller.js** - Report modification
5. **ReportDisplay.controller.js** - Read-only report viewing

### 3.2 Data Entities
- **ProjectCostRept** (Header) - Main report entity
- **HeaderItem** - Project breakdown items
- **Valuation** - Certificate and valuation data
- **CostDetail/CostItem** - Detailed cost breakdowns
- **ProjectCostSummaryData** - Aggregated cost information

### 3.3 Authorization Framework
```javascript
// Three-tier authorization system
AuthorizationHelper.canDisplay()  // "03" - Read access
AuthorizationHelper.canCreate()   // "01" - Create access  
AuthorizationHelper.canChange()   // "02" - Modify access
```

## 4. User Interface Design

### 4.1 Navigation Pattern
```
Selection Screen → [Create/Change/Display] → Report Views
    ↓
Project Selection
Report Parameters
Line Item Options
    ↓
Authorized Access Check
    ↓
Multi-Section Report Layout
```

### 4.2 Report Sections
1. **Header Form** - Project details, dates, margins
2. **Header Item Table** - WBS elements and forecasts
3. **Valuation Table** - Certifications and movements
4. **Cost Tables** - Summary or detailed item views

### 4.3 Responsive Design
- **Desktop**: 3-column layout with full feature set
- **Tablet**: Adaptive column layout
- **Mobile**: Single column with touch optimization

## 5. Data Flow Architecture

### 5.1 Report Lifecycle
```
Selection → Authorization → Data Retrieval → Calculations → Display
     ↓
Create: New Entry → Validation → Save → Navigation
Change: Load Existing → Modify → Validation → Update
Display: Load Existing → Read-Only View
```

### 5.2 Calculation Engine
- **Real-time Calculations**: Margins, variances, projections
- **Currency Formatting**: SAP-standard formatting with AED default
- **Hierarchical Totals**: WBS-level subtotals and grand totals
- **Cross-table Dependencies**: Header items reference cost data

## 6. Integration Points

### 6.1 SAP Backend Integration
- **OData Service**: `/sap/opu/odata/sap/Z_UI_PPM_PROJECTCOSTRPT_O2/`
- **Annotations**: `Z_UI_PPM_PROJECTCOSTRPT_O2_VAN`
- **Batch Processing**: Optimized data operations
- **Change Tracking**: Model-based change detection

### 6.2 External Systems
- **Project Management**: WBS element integration
- **Financial Systems**: Cost center and currency data
- **Authorization**: SAP role-based permissions
- **Document Management**: Export capabilities

## 7. Key Design Patterns

### 7.1 MVC Architecture
- **Models**: OData V2 with two-way binding
- **Views**: XML-based declarative UI
- **Controllers**: Event-driven business logic

### 7.2 Smart Controls Integration
- **SmartForm**: Metadata-driven form generation
- **SmartField**: Automatic field rendering and validation
- **SmartTable**: Enhanced table functionality

### 7.3 Fragment-Based Design
- Reusable UI components
- Modular table structures
- Shared dialog components

## 8. Performance Considerations

### 8.1 Data Loading Strategies
- **Skeleton Screens**: Progressive loading indication
- **Lazy Loading**: On-demand data retrieval
- **Batch Operations**: Grouped backend calls
- **Client-side Caching**: Model-level data retention

### 8.2 UI Optimization
- **Responsive Breakpoints**: Device-specific layouts
- **Table Virtualization**: Large dataset handling
- **Busy Indicators**: User feedback during operations

## 9. Security & Compliance

### 9.1 Access Control
- **Role-based Authorization**: Function-specific permissions
- **Route Protection**: URL-level access validation
- **Data Filtering**: User-context sensitive data

### 9.2 Data Validation
- **Client-side Validation**: Immediate user feedback
- **Server-side Validation**: Backend data integrity
- **Currency Validation**: Proper decimal handling

## 10. Deployment & Configuration

### 10.1 Build Configuration
- **UI5 Tooling**: Standard SAP build process
- **Manifest Configuration**: Service endpoints and routing
- **Resource Optimization**: CSS and JS bundling

### 10.2 Environment Setup
- **Development**: Local mock services
- **Testing**: Integrated OData services
- **Production**: Full SAP backend integration

## 11. Future Enhancements

### 11.1 Planned Features
- **Advanced Analytics**: Chart and graph integration
- **Milestone Tracking**: Timeline visualization
- **Bulk Operations**: Multi-report processing
- **Mobile Optimization**: Enhanced mobile experience

### 11.2 Technical Improvements
- **Performance Monitoring**: User experience metrics
- **Error Handling**: Enhanced user messaging
- **Accessibility**: WCAG compliance
- **API Extensions**: Additional OData operations

---

**Document Version**: 1.0  
**Last Updated**: September 2025  
**Author**: Development Team  
**Classification**: Internal Use
