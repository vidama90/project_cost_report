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
    
    return BaseController.extend("com.atg.ppm.postfinrevenue.controller.ReportChange", {
        onInit: function() {
            // Initialize UI controls and models similar to ReportCreate.controller.js
            this.UIControls = this.getUIControlls();
            
            // Initialize form and tables
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
            
            // Set change mode
            this.Models.ViewControl.setProperty('/Mode/IsCreate', false);
            this.Models.ViewControl.setProperty('/Mode/IsUpdate', true);
            
            // Enable change mode for field editability
            this.enableChangeMode(this.Models);
            
            // Attach to route matched event
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("change").attachPatternMatched(this._onChangeMatched, this);
            
            // Initialize table personalizers
            this._oHITablePersoController = TablePersonalizer.create(this.UIControls.HeaderItemTable);
            this._oValuationTablePersoController = TablePersonalizer.create(this.UIControls.ValuationTable);
            this._oCostDetailTablePersoController = TablePersonalizer.create(this.UIControls.CostSummaryTable);
            this._oCostItemTablePersoController = TablePersonalizer.create(this.UIControls.CostItemTable);
            
            this.bInputForecastFinalValue = true; // Flag to control input field behavior

            // Activate initial load gating for update mode
            this._initialLoadActive = true;


        },
        
        _onChangeMatched: function(oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            var sReportId = oArgs.reportId;
            var sCutOffDate = oArgs.cutOffDate;
            
            // Store the cutoff date for use in the controller
            this.sCutOffDate = sCutOffDate;
            
            // Set up filters for data loading
            var oFilter = new Filter("ReportNumber", FilterOperator.EQ, sReportId);
            var aFilters = [oFilter];
            
            // Parse the cutoff date
            var dCutOffDate = null;
            if (sCutOffDate) {
                dCutOffDate = new Date(sCutOffDate);
            }
            
            // Create a selection object with available information
            var oSelection = {
                ReportNumber: sReportId,
                CutOffDate: dCutOffDate
            };
            
            // Store cutoff date globally for use in other functions
            this.CutOffDate = dCutOffDate;
            
            // Initialize the report in change mode
            this.initReport("/ProjectCostRept", aFilters, this.UIControls, this.Models, oSelection, "02");
        },
        
        onNavBack: function() {
            // Show confirmation dialog
            MessageBox.confirm(this.getResourceBundle().getText('leaveWarning'), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        this.getOwnerComponent().getRouter().navTo("home");
                    }
                }
            });
        },
        
        // Copy methods from ProjectCostReport.controller.js for change functionality
        onClickRefresh: function() {

               // Disable gating before recalculations
               this.disableInitialLoadGating();

             this.setHeaderSmartFormProperties(this.UIControls.HeaderSmartForm);

            this.setHeaderItemTableFields(this.UIControls.HeaderSmartForm, this.UIControls.HeaderItemTable, this.UIControls.ValuationTable, this.getCostTable(this.UIControls));
            this.generateTotalFooter(this.UIControls.HeaderItemTable);
            this.formatHeaderItemTable(this.UIControls.HeaderItemTable);

            this.setValuationTableFields(this.UIControls.ValuationTable);
            this.generateTotalFooter(this.UIControls.ValuationTable);
            this.formatValuationTable(this.UIControls.ValuationTable);

            this.setCostSummaryTableFields(this.UIControls.CostSummaryTable);
            this.calculateTableTotals(this.UIControls.CostSummaryTable);

            this.setCostItemTableFields(this.UIControls.CostItemTable);
            this.calculateTableTotals(this.UIControls.CostItemTable);

            MessageToast.show("Values Updated");
        },
        
        onClickReset: function() {
            // Similar to ReportCreate.controller.js but for change mode
            var oModel = this.getModel();
            
            MessageBox.confirm(this.getResourceBundle().getText("resetConfirmation"), {
                title: this.getResourceBundle().getText("resetTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        BusyIndicator.show(0);
                        
                        try {
                            // In update mode, refresh model to reload data from backend
                            oModel.refresh(true);
                            
                            // Refresh all tables
                            this.refreshTable(this.UIControls.HeaderItemTable);
                            this.refreshTable(this.UIControls.ValuationTable);
                            this.refreshTable(this.UIControls.CostSummaryTable);
                            this.refreshTable(this.UIControls.CostItemTable);
                            
                            MessageToast.show(this.getResourceBundle().getText("resetSuccess"));
                        } catch (oError) {
                            MessageBox.error(this.getResourceBundle().getText("resetError") + ": " + oError.message);
                        } finally {
                            BusyIndicator.hide();
                        }
                    }
                }
            });
        },
        
        onPressUpdateReport: function() {
            // User initiated update; allow calculations
            this.disableInitialLoadGating();
            this.updateReport(this.UIControls, this.Models, '');
        }
        
        // Include other methods from ProjectCostReport.controller.js needed for change functionality
        // ...
    });
});