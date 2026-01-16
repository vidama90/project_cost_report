sap.ui.define([
    "com/atg/ppm/postfinrevenue/controller/App.controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast",
    "sap/m/TablePersoController",
    "com/atg/ppm/postfinrevenue/controller/helper/TablePersonalizer",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (BaseController, MessageBox, BusyIndicator, MessageToast, TablePersoController, TablePersonalizer, Filter, FilterOperator) => {
    "use strict";
    
    return BaseController.extend("com.atg.ppm.postfinrevenue.controller.ReportDisplay", {
        /**
         * Called when controller is initialized
         */
        onInit: function() {
            // Initialize UI controls
            this.UIControls = this.getUIControlls();
            
            // Get references to SmartForms and Tables
            this.UIControls.HeaderSmartForm = this.getView().byId("HeaderSmartForm");
            this.UIControls.HeaderItemTable = this.getView().byId("HeaderItemTable");
            this.UIControls.ValuationTable = this.getView().byId("ValuationTable");
            this.UIControls.CostSummaryTable = this.getView().byId("CostSummaryTable");
            this.UIControls.CostItemTable = this.getView().byId("CostItemTable");
            
            // Initialize view models
            var oViewControlModel = this.createViewModel();
            this.getView().setModel(oViewControlModel, 'ViewControl');
            
            var oCurrModel = this.createCurrencyModel();
            this.getView().setModel(oCurrModel, 'Currency');
            
            this.Models = this.getAllModels();
            this.Models.ViewControl = this.getView().getModel('ViewControl');
            this.Models.Currency = this.getView().getModel('Currency');
            
            // Set display mode (read-only)
            this.Models.ViewControl.setProperty('/Mode/IsCreate', false);
            this.Models.ViewControl.setProperty('/Mode/IsUpdate', false);
            this.Models.ViewControl.setProperty('/Mode/IsDisplay', true);
            //this.Models.ViewControl.setProperty('/Title', this.getResourceBundle().getText("display"));
            
            // Attach to route matched event
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("display").attachPatternMatched(this._onDisplayMatched, this);
            
            // Disable all edit controls
            this._setControlsReadOnly(true);

            this.bInputForecastFinalValue = true; // Flag to control input field behavior

            // Activate initial load gating: suppress calculations except footers
            this._initialLoadActive = true;
            
            // Initialize table personalizers
            this._oHITablePersoController = TablePersonalizer.create(this.UIControls.HeaderItemTable);
            this._oValuationTablePersoController = TablePersonalizer.create(this.UIControls.ValuationTable);
            this._oCostDetailTablePersoController = TablePersonalizer.create(this.UIControls.CostSummaryTable);
            this._oCostItemTablePersoController = TablePersonalizer.create(this.UIControls.CostItemTable);
        },
        
        /**
         * Handles route pattern matching when displaying a report
         * @param {sap.ui.base.Event} oEvent Pattern matched event
         */
        _onDisplayMatched: function(oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            var sReportId = oArgs.reportId;
            var sCutOffDate = oArgs.cutOffDate;
            
            // Store report ID and cutoff date
            this.sReportId = sReportId;
            this.sCutOffDate = sCutOffDate;
            
            // Parse the cutoff date
            var dCutOffDate = null;
            if (sCutOffDate) {
                dCutOffDate = new Date(sCutOffDate);
            }
            this.CutOffDate = dCutOffDate;
            
            // Set up filters for data loading
            var oFilter = new sap.ui.model.Filter("ReportNumber", sap.ui.model.FilterOperator.EQ, sReportId);
            var aFilters = [oFilter];
            
            BusyIndicator.show(0);
            
            // Create a minimal selection object with available information
            var oSelection = {
                ReportNumber: sReportId,
                CutOffDate: dCutOffDate
            };
            
            // Initialize the report in display mode
            this.initReport("/ProjectCostRept", aFilters, this.UIControls, this.Models, oSelection, "03");
            
            // Apply read-only styling
            this.enableDisplayMode(this.Models);
        },
        
        /**
         * Override initSuccess to bind cost detail after data is loaded
         * This ensures the ViewControl model properties are set before we try to bind tables
         */
        initSuccess: function(Models) {
            // Call parent initSuccess
            this.getModel().resetChanges();
            Models.ViewControl.setProperty("/Sections/IsVisible", true);
            Models.ViewControl.setProperty("/SelectionScreen/IsVisible", false);
            this.ensureSmartFormContentLoaded();
            
            // Now bind cost detail with parameterized entity
            this._bindCostDetailParameterized();
        },
        
        /**
         * Bind Cost Detail table to parameterized entity for display
         * Uses P_RptProjectCostDetail for reading data in display mode
         * Uses same binding approach as update scenario (only p_pcrnum parameter)
         * Gets values from HeaderSmartForm binding context instead of controller properties
         * @private
         */
        _bindCostDetailParameterized: function() {
            var that = this;
            
            // Get report number from HeaderSmartForm binding context instead of controller property
            var oHeaderContext = this.UIControls.HeaderSmartForm.getBindingContext();
            if (!oHeaderContext) {
                console.warn("Header context not available for parameterized binding");
                return;
            }
            
            var oHeaderData = oHeaderContext.getObject();
            var sReportNumber = oHeaderData.ReportNumber;
            var sProjectId = oHeaderData.ProjectExternalID || oHeaderData.ProjectNumber || "";
            
            if (!sReportNumber) {
                console.warn("Report number not available in context for parameterized binding");
                return;
            }
            
            var oCostSummaryTable = this.UIControls.CostSummaryTable;
            var oCostItemTable = this.UIControls.CostItemTable;
            
            // Check visibility from ViewControl model instead of runtime getVisible()
            var bShowCostSummary = this.Models.ViewControl.getProperty('/Tables/ShowCostSummary');
            var bShowCostItem = this.Models.ViewControl.getProperty('/Tables/ShowCostItem');
            
            console.log("Binding cost detail for Display - Report: " + sReportNumber + ", Project: " + sProjectId);
            console.log("ShowCostSummary: " + bShowCostSummary + ", ShowCostItem: " + bShowCostItem);
            
            // Construct parameterized entity path for FAST read
            // P_RptProjectCostDetail only needs p_pcrnum (report number) parameter - same as update scenario
            var sParameterizedPath = "/P_RptProjectCostDetail(p_pcrnum='" + 
                encodeURIComponent(sReportNumber) + "')/Set";
            
            console.log("Reading from parameterized path: " + sParameterizedPath);
            
            // Determine which table is visible and bind it
            if (oCostSummaryTable && bShowCostSummary) {
                oCostSummaryTable.bindRows({
                    path: sParameterizedPath,
                    sorter: new sap.ui.model.Sorter('counter', false),
                    events: {
                        dataReceived: function() {
                            that.calculateTableTotals(oCostSummaryTable);
                            that.showSkeletonScreen(false);
                        }
                    }
                });
                console.log("Cost Summary table bound to parameterized entity: " + sParameterizedPath);
            }
            
            if (oCostItemTable && bShowCostItem) {
                oCostItemTable.bindRows({
                    path: sParameterizedPath,
                    sorter: new sap.ui.model.Sorter('counter', false),
                    events: {
                        dataReceived: function() {
                            that.calculateTableTotals(oCostItemTable);
                            that.showSkeletonScreen(false);
                        }
                    }
                });
                console.log("Cost Item table bound to parameterized entity: " + sParameterizedPath);
            }
        },
        
        /**
         * Handles navigation back to selection screen
         */
        onNavBack: function() {
            this.getOwnerComponent().getRouter().navTo("home");
        },
        
        /**
         * Apply read-only styling to the entire view
         * @private
         */
        _applyReadOnlyStyling: function() {
            // Apply read-only styling to forms
            if (this.UIControls.HeaderSmartForm) {
                this.UIControls.HeaderSmartForm.getGroups().forEach(function(oGroup) {
                    oGroup.getGroupElements().forEach(function(oElement) {
                        var aFields = oElement.getFields();
                        aFields.forEach(function(oField) {
                            if (oField.setEditable) {
                                oField.setEditable(false);
                            } else if (oField.setEnabled) {
                                oField.setEnabled(false);
                            }
                        });
                    });
                });
            }
            
            // Disable all action buttons
            this._disableActionButtons();
        },
        
        /**
         * Sets all controls to read-only mode
         * @param {boolean} bReadOnly Whether controls should be read-only
         * @private
         */
        _setControlsReadOnly: function(bReadOnly) {
            // Set form to read-only
            if (this.UIControls.HeaderSmartForm) {
                this.UIControls.HeaderSmartForm.setEditable(!bReadOnly);
            }
            
        },
        
        /**
         * Disables all action buttons in the application
         * @private
         */
        _disableActionButtons: function() {
            // Simply disable the form's edit functionality
            if (this.UIControls.HeaderSmartForm) {
                this.UIControls.HeaderSmartForm.setEditable(false);
            }
            
            // Hide specific buttons by ID if they exist
            try {
                var aButtonIds = ["saveButton", "editButton", "deleteButton", "createButton", "submitButton"];
                aButtonIds.forEach(function(sId) {
                    var oButton = this.getView().byId(sId);
                    if (oButton) {
                        oButton.setVisible(false);
                    }
                }.bind(this));
            } catch (error) {
                console.warn("Could not disable action buttons:", error);
            }
        },
        
        /**
         * Refresh report data
         * Gets report number from HeaderSmartForm binding context instead of controller property
         */
        onClickRefresh: function() {
            // Get report number from context instead of controller property
            var oHeaderContext = this.UIControls.HeaderSmartForm.getBindingContext();
            if (!oHeaderContext) {
                console.warn("Header context not available for refresh");
                return;
            }
            
            var oHeaderData = oHeaderContext.getObject();
            var sReportNumber = oHeaderData.ReportNumber;
            
            if (!sReportNumber) {
                return;
            }
            
            BusyIndicator.show(0);
            
            var oFilter = new sap.ui.model.Filter("ReportNumber", sap.ui.model.FilterOperator.EQ, sReportNumber);
            var aFilters = [oFilter];
            
            // Create a minimal selection object with available information
            var oSelection = {
                ReportNumber: sReportNumber
            };
            
            // Disable gating so calculations run from now on
            this.disableInitialLoadGating();

            // Re-initialize report in display mode
            this.initReport("/ProjectCostRept", aFilters, this.UIControls, this.Models, oSelection, "03");
            
            MessageToast.show(this.getResourceBundle().getText("refreshSuccess"));
        },
        
        /**
         * Customize export to Excel in display mode
         * Gets report number from HeaderSmartForm binding context for filename
         */
        onExportToExcel: function() {
            // Implement Excel export functionality
            var oTable = this.UIControls.CostSummaryTable || this.UIControls.CostItemTable;
            if (!oTable) {
                return;
            }
            
            // Get report number from context for filename
            var oHeaderContext = this.UIControls.HeaderSmartForm.getBindingContext();
            var sReportNumber = oHeaderContext ? oHeaderContext.getObject().ReportNumber : "Unknown";
            
            sap.ui.require(["sap/ui/export/Spreadsheet"], function(Spreadsheet) {
                var oSettings = {
                    workbook: {
                        columns: this._createColumnConfig(oTable),
                        context: {
                            application: 'Project Cost Report',
                            version: '1.0',
                            title: this.getResourceBundle().getText("exportTitle")
                        }
                    },
                    dataSource: oTable.getBinding("rows").getContexts().map(function(oContext) {
                        return oContext.getObject();
                    }),
                    fileName: 'ProjectCostReport_' + sReportNumber + '.xlsx'
                };
                
                var oSheet = new Spreadsheet(oSettings);
                oSheet.build().finally(function() {
                    oSheet.destroy();
                });
            }.bind(this));
        },
        
        /**
         * Create column configuration for Excel export
         * @param {sap.ui.table.Table} oTable Table to export
         * @returns {Array} Column configuration
         * @private
         */
        _createColumnConfig: function(oTable) {
            var aColumns = [];
            var aTableColumns = oTable.getColumns();
            
            aTableColumns.forEach(function(oColumn) {
                var oTemplate = oColumn.getTemplate();
                var sPath = "";
                
                if (oTemplate.getBindingInfo("text")) {
                    sPath = oTemplate.getBindingInfo("text").parts[0].path;
                } else if (oTemplate.getBindingInfo("value")) {
                    sPath = oTemplate.getBindingInfo("value").parts[0].path;
                }
                
                if (sPath) {
                    aColumns.push({
                        label: oColumn.getLabel().getText(),
                        property: sPath,
                        type: 'string'
                    });
                }
            });
            
            return aColumns;
        }
    });
});