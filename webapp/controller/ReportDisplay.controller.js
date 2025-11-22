sap.ui.define([
    "com/atg/ppm/postfinrevenue/controller/App.controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast"
], (BaseController, MessageBox, BusyIndicator, MessageToast) => {
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
        },
        
        /**
         * Handles route pattern matching when displaying a report
         * @param {sap.ui.base.Event} oEvent Pattern matched event
         */
        _onDisplayMatched: function(oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            var sReportId = oArgs.reportId;
            
            // Store report ID
            this.sReportId = sReportId;
            
            // Set up filters for data loading
            var oFilter = new sap.ui.model.Filter("ReportNumber", sap.ui.model.FilterOperator.EQ, sReportId);
            var aFilters = [oFilter];
            
            BusyIndicator.show(0);
            
            // Create a minimal selection object with available information
            var oSelection = {
                ReportNumber: sReportId
            };
            
            // Initialize the report in display mode
            this.initReport("/ProjectCostRept", aFilters, this.UIControls, this.Models, oSelection, "03");
            
            // Apply read-only styling
            this.enableDisplayMode(this.Models);
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
         */
        onClickRefresh: function() {
            if (!this.sReportId) {
                return;
            }
            
            BusyIndicator.show(0);
            
            var oFilter = new sap.ui.model.Filter("ReportNumber", sap.ui.model.FilterOperator.EQ, this.sReportId);
            var aFilters = [oFilter];
            
            // Create a minimal selection object with available information
            var oSelection = {
                ReportNumber: this.sReportId
            };
            
            // Re-initialize report in display mode
            this.initReport("/ProjectCostRept", aFilters, this.UIControls, this.Models, oSelection, "03");
            
            MessageToast.show(this.getResourceBundle().getText("refreshSuccess"));
        },
        
        /**
         * Customize export to Excel in display mode
         */
        onExportToExcel: function() {
            // Implement Excel export functionality
            var oTable = this.UIControls.CostSummaryTable || this.UIControls.CostItemTable;
            if (!oTable) {
                return;
            }
            
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
                    fileName: 'ProjectCostReport_' + this.sReportId + '.xlsx'
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