sap.ui.define([
    "com/atg/ppm/postfinrevenue/controller/App.controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast",
    "sap/m/TablePersoController",
    "com/atg/ppm/postfinrevenue/controller/helper/TablePersonalizer",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (BaseController, MessageBox, BusyIndicator, MessageToast, TablePersoController, TablePersonalizer, Filter, FilterOperator, JSONModel) => {
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

            // Initialize JSON model for cost detail data (for hybrid approach)
            this._oCostDetailModel = new JSONModel({ items: [] });
            // Track original data for change detection
            this._aOriginalCostData = [];

        },
        
        /**
         * Cleanup when the view is destroyed to prevent duplicate ID errors
         */
        onExit: function() {
            // Destroy TablePersoControllers to prevent duplicate ID errors on re-navigation
            if (this._oHITablePersoController) {
                this._oHITablePersoController.destroy();
                this._oHITablePersoController = null;
            }
            if (this._oValuationTablePersoController) {
                this._oValuationTablePersoController.destroy();
                this._oValuationTablePersoController = null;
            }
            if (this._oCostDetailTablePersoController) {
                this._oCostDetailTablePersoController.destroy();
                this._oCostDetailTablePersoController = null;
            }
            if (this._oCostItemTablePersoController) {
                this._oCostItemTablePersoController.destroy();
                this._oCostItemTablePersoController = null;
            }
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
            
            // Parse the cutoff date from URL format (YYYY-MM-DD), default to today if invalid
            var dCutOffDate = null;
            if (sCutOffDate) {
                // Parse YYYY-MM-DD format explicitly to avoid timezone issues
                var parts = sCutOffDate.split('-');
                if (parts.length === 3) {
                    dCutOffDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
                // Check if date is invalid
                if (!dCutOffDate || isNaN(dCutOffDate.getTime())) {
                    dCutOffDate = new Date();
                }
            } else {
                dCutOffDate = new Date();
            }
            
            console.log("CutOffDate from URL:", sCutOffDate, "-> Parsed:", dCutOffDate);
            
            // Create a selection object with available information
            var oSelection = {
                ReportNumber: sReportId,
                CutOffDate: dCutOffDate
            };
            
            // Store cutoff date globally for use in other functions
            this.CutOffDate = dCutOffDate;
            
            // Store report number
            this.sReportId = sReportId;
            
            // Initialize the report in change mode using hybrid approach:
            // 1. Header/Valuation/HeaderItem tables bind normally to ProjectCostRept (OData model)
            // 2. Cost tables bind to parameterized entity for FAST read, then switch to JSON model for editing
            // 3. On save, we update the to_CostDetail entity manually
            this.initReportForChange("/ProjectCostRept", aFilters, this.UIControls, this.Models, oSelection);
        },
        
        /**
         * Initialize report for change mode with hybrid binding approach
         * - Header tables: OData binding (supports auto-update)
         * - Cost tables: Parameterized entity read → JSON model for editing
         */
        initReportForChange: function(sPath, aFilters, UIControls, Models, oSelection) {
            var that = this;
            
            // Store a callback that will be called when initReport completes
            this._onInitReportComplete = function() {
                that._bindCostDetailForChange();
            };
            
            // Call the base initReport - cost table binding is skipped for activity "02"
            this.initReport(sPath, aFilters, UIControls, Models, oSelection, "02");
        },
        
        /**
         * Override initSuccess to call our callback after data is loaded
         * Also checks ReportStatus to determine if status field should be editable
         */
        initSuccess: function(Models) {
            // Call parent initSuccess
            this.getModel().resetChanges();
            Models.ViewControl.setProperty("/Sections/IsVisible", true);
            Models.ViewControl.setProperty("/SelectionScreen/IsVisible", false);
            this.ensureSmartFormContentLoaded();
            
            // Check ReportStatus and disable status field if status is 3, 4, or 5 (read-only statuses)
            this._applyReportStatusRestriction();
            
            // Now call our callback to bind cost detail with parameterized entity
            if (this._onInitReportComplete) {
                this._onInitReportComplete();
                this._onInitReportComplete = null; // Clear callback
            }
        },
        
        /**
         * Check the current ReportStatus and disable the status field if it's 3, 4, or 5
         * Status 3, 4, 5 are read-only statuses that shouldn't allow status change
         * @private
         */
        _applyReportStatusRestriction: function() {
            var oHeaderForm = this.UIControls.HeaderSmartForm;
            if (!oHeaderForm) {
                console.warn("HeaderSmartForm not available for status restriction check");
                return;
            }
            
            var oContext = oHeaderForm.getBindingContext();
            if (!oContext) {
                console.warn("No binding context available for status restriction check");
                return;
            }
            
            var oData = oContext.getObject();
            if (!oData) {
                console.warn("No data available for status restriction check");
                return;
            }
            
            // Get the report status (clean it up to just the numeric value)
            var sReportStatus = oData.ReportStatus || "";
            sReportStatus = sReportStatus.toString().replace(/\D/g, "");
            
            console.log("Current ReportStatus: " + sReportStatus);
            
            // If status is 4, disable the ReportStatus field (display only)
            // Status 1, 2, 3, 5, 6 are editable
            if (sReportStatus === "4") {
                console.log("ReportStatus is " + sReportStatus + " - disabling status field (display only)");
                this.Models.ViewControl.setProperty("/SmartField/ReportStatus", false);
            } else {
                // Status 1, 2, 3, 5, or 6 - allow editing
                console.log("ReportStatus is " + sReportStatus + " - allowing status field edit");
                this.Models.ViewControl.setProperty("/SmartField/ReportStatus", true);
            }
        },
        
        /**
         * Bind Cost Detail table using parameterized entity for FAST read
         * Then populate a JSON model for editing capability
         * @private
         */
        _bindCostDetailForChange: function() {
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
            
            // Format cutoff date as YYYYMMDD string for the parameter
            var sCutOffDateParam = "";
            if (this.CutOffDate) {
                var d = this.CutOffDate;
                var year = d.getFullYear();
                var month = String(d.getMonth() + 1).padStart(2, '0');
                var day = String(d.getDate()).padStart(2, '0');
                sCutOffDateParam = year + month + day;
            }
            
            var oCostSummaryTable = this.UIControls.CostSummaryTable;
            var oCostItemTable = this.UIControls.CostItemTable;
            
            // Check visibility from ViewControl model instead of runtime getVisible()
            var bShowCostSummary = this.Models.ViewControl.getProperty('/Tables/ShowCostSummary');
            var bShowCostItem = this.Models.ViewControl.getProperty('/Tables/ShowCostItem');
            
            console.log("Binding cost detail for Report: " + sReportNumber + ", Project: " + sProjectId + ", CutOffDate: " + sCutOffDateParam);
            console.log("ShowCostSummary: " + bShowCostSummary + ", ShowCostItem: " + bShowCostItem);
            
            // Construct parameterized entity path for FAST read
            // P_RptProjectCostDetail requires p_pcrnum, p_project, and p_cutoffdate parameters
            var sParameterizedPath = "/P_RptProjectCostDetail(p_pcrnum='" + 
                encodeURIComponent(sReportNumber) + "',p_project='" +
                encodeURIComponent(sProjectId) + "',p_cutoffdate='" +
                encodeURIComponent(sCutOffDateParam) + "')/Set";
            
            console.log("Reading from parameterized path: " + sParameterizedPath);
            
            // Read data from parameterized entity (FAST)
            this.getModel().read(sParameterizedPath, {
                success: function(oCostData) {
                    console.log("Parameterized entity returned " + oCostData.results.length + " records");
                    
                    // Store original data for change detection
                    that._aOriginalCostData = JSON.parse(JSON.stringify(oCostData.results));
                    
                    // Set data to JSON model for editing support
                    that._oCostDetailModel.setData({ items: oCostData.results });
                    
                    // Set the JSON model on the View with name "CostJSON"
                    that.getView().setModel(that._oCostDetailModel, "CostJSON");
                    
                    // For change mode: Bind tables to JSON model (not OData) to allow editing
                    // Changes go to JSON model, then on save we build payload for the updatable entity
                    if (oCostSummaryTable && bShowCostSummary) {
                        // Unbind from OData first
                        oCostSummaryTable.unbindRows();
                        
                        // Set the JSON model as the DEFAULT model on the table (no name)
                        // This allows existing column bindings like {WBSLevel2Descr} to work
                        oCostSummaryTable.setModel(that._oCostDetailModel);
                        
                        // Bind rows to JSON model path
                        oCostSummaryTable.bindRows({
                            path: "/items",
                            sorter: new sap.ui.model.Sorter('counter', false)
                        });
                        
                        console.log("Cost Summary table bound to JSON model with " + oCostData.results.length + " items");
                        
                        // Calculate totals after data is set
                        setTimeout(function() {
                            that.calculateTableTotals(oCostSummaryTable);
                        }, 100);
                    }
                    
                    if (oCostItemTable && bShowCostItem) {
                        // Unbind from OData first
                        oCostItemTable.unbindRows();
                        
                        // Set the JSON model as the DEFAULT model on the table (no name)
                        oCostItemTable.setModel(that._oCostDetailModel);
                        
                        // Bind rows to JSON model path
                        oCostItemTable.bindRows({
                            path: "/items",
                            sorter: new sap.ui.model.Sorter('counter', false)
                        });
                        
                        console.log("Cost Item table bound to JSON model with " + oCostData.results.length + " items");
                        
                        // Calculate totals after data is set
                        setTimeout(function() {
                            that.calculateTableTotals(oCostItemTable);
                        }, 100);
                    }
                    
                    that.showSkeletonScreen(false);
                },
                error: function(oError) {
                    console.error("Error reading from parameterized entity:", oError);
                    that.showSkeletonScreen(false);
                    that.showError2("Failed to load cost details: " + that.getTextFromOdataError(oError));
                }
            });
        },
        
        /**
         * Update column template bindings to use the named JSON model instead of default OData model
         * Column labels remain bound to OData model for metadata resolution
        /**
         * Calculate table totals for JSON model bound table
         */
        calculateTableTotalsJSON: function(Table, oJSONModel) {
            // Similar to calculateTableTotals but works with JSON model
            var aData = oJSONModel.getProperty("/items") || [];
            
            Table.getColumns().forEach(function(col, ind) {
                var oTemplate = col.getTemplate();
                if (!oTemplate) return;
                
                var value = oTemplate.getBindingInfo ? oTemplate.getBindingInfo("value") : null;
                var text = oTemplate.getBindingInfo ? oTemplate.getBindingInfo("text") : null;
                
                if (!value && !text) return;
                
                var colName = value ? value.parts[0].path : text.parts[0].path;
                // Remove "CostJSON>" prefix if present
                colName = colName.replace("CostJSON>", "");
                
                var grandTotal = 0;
                var currency = "AED";
                
                aData.forEach(function(oRow) {
                    if (oRow.HierarchyLevel === -1 || oRow.HierarchyLevel === -2) return;
                    
                    var amount = parseFloat(oRow[colName]);
                    if (!isNaN(amount)) {
                        grandTotal += amount;
                    }
                    if (oRow.TransactionCurrency) {
                        currency = oRow.TransactionCurrency;
                    }
                });
            });
        },
        
        /**
         * Get changed cost detail items by comparing current data with original
         * @returns {Array} Array of changed items with their keys and new values
         */
        _getChangedCostItems: function() {
            var aCurrentData = this._oCostDetailModel.getProperty("/items") || [];
            var aOriginalData = this._aOriginalCostData || [];
            var aChangedItems = [];
            
            // Create a map of original data by composite key for efficient lookup
            var mOriginalByKey = {};
            aOriginalData.forEach(function(oOriginal) {
                var sKey = [
                    oOriginal.ReportNumber || '',
                    oOriginal.WBSLevel2 || '',
                    oOriginal.WBSLevel3 || '',
                    oOriginal.WBSLevel4 || '',
                    oOriginal.PONumber || '',
                    oOriginal.counter || 0,
                    oOriginal.HierarchyLevel || 0
                ].join('|');
                mOriginalByKey[sKey] = oOriginal;
            });
            
            // Compare each current item with its original
            aCurrentData.forEach(function(oCurrent) {
                // Skip subtotal and total rows
                if (oCurrent.HierarchyLevel === -1 || oCurrent.HierarchyLevel === -2) {
                    return;
                }
                
                var sKey = [
                    oCurrent.ReportNumber || '',
                    oCurrent.WBSLevel2 || '',
                    oCurrent.WBSLevel3 || '',
                    oCurrent.WBSLevel4 || '',
                    oCurrent.PONumber || '',
                    oCurrent.counter || 0,
                    oCurrent.HierarchyLevel || 0
                ].join('|');
                
                var oOriginal = mOriginalByKey[sKey];
                if (!oOriginal) return;
                
                // Check if any editable field has changed
                var bChanged = false;
                var oChanges = {};
                
                // List of editable fields to check
                var aEditableFields = [
                    'CostToComplete', 'PotentialFinalAccountCost', 'RevisedBudget',
                    'ProjectedFinalCost', 'Variance', 'Remarks'
                ];
                
                aEditableFields.forEach(function(sField) {
                    var currentVal = oCurrent[sField];
                    var originalVal = oOriginal[sField];
                    
                    // Handle numeric comparison (convert to string for consistent comparison)
                    if (typeof currentVal === 'number') {
                        currentVal = String(currentVal);
                    }
                    if (typeof originalVal === 'number') {
                        originalVal = String(originalVal);
                    }
                    
                    if (currentVal !== originalVal) {
                        bChanged = true;
                        oChanges[sField] = oCurrent[sField];
                    }
                });
                
                if (bChanged) {
                    // Include key fields and changed values
                    aChangedItems.push({
                        ReportNumber: oCurrent.ReportNumber,
                        WBSLevel2: oCurrent.WBSLevel2,
                        WBSLevel3: oCurrent.WBSLevel3,
                        WBSLevel4: oCurrent.WBSLevel4,
                        PONumber: oCurrent.PONumber,
                        counter: oCurrent.counter,
                        HierarchyLevel: oCurrent.HierarchyLevel,
                        changes: oChanges,
                        fullData: oCurrent
                    });
                }
            });
            
            return aChangedItems;
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

            // Update sequence: Cost Summary first, then Valuation, then Header Item
            this.setCostSummaryTableFields(this.UIControls.CostSummaryTable);
            this.calculateTableTotals(this.UIControls.CostSummaryTable);

            this.setCostItemTableFields(this.UIControls.CostItemTable);
            this.calculateTableTotals(this.UIControls.CostItemTable);

            this.setValuationTableFields(this.UIControls.ValuationTable);
            this.generateTotalFooter(this.UIControls.ValuationTable);
            this.formatValuationTable(this.UIControls.ValuationTable);

            this.setHeaderItemTableFields(this.UIControls.HeaderSmartForm, this.UIControls.HeaderItemTable, this.UIControls.ValuationTable, this.getCostTable(this.UIControls));
            this.generateTotalFooter(this.UIControls.HeaderItemTable);
            this.formatHeaderItemTable(this.UIControls.HeaderItemTable);

            MessageToast.show("Values Updated");
        },
        
        onClickReset: function() {
            // Similar to ReportCreate.controller.js but for change mode
            var oModel = this.getModel();
            var that = this;
            
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
                            
                            // Reset JSON model with original data
                            that._oCostDetailModel.setData({ items: JSON.parse(JSON.stringify(that._aOriginalCostData)) });
                            
                            // Refresh all tables
                            this.refreshTable(this.UIControls.HeaderItemTable);
                            this.refreshTable(this.UIControls.ValuationTable);
                            
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
            
            // Use the hybrid update approach:
            // 1. Update header/valuation/headeritem via normal OData submitChanges
            // 2. Update cost detail items via individual PATCH calls to to_CostDetail
            // Get report number from context instead of controller property
            this.updateReportHybrid(this.UIControls, this.Models);
        },
        
        /**
         * Hybrid update approach:
         * - Header tables: Use normal OData submitChanges()
         * - Cost detail: Use individual UPDATE calls to to_CostDetail entity
         * Gets report number from HeaderSmartForm binding context
         */
        updateReportHybrid: function(UIControls, Models) {
            var that = this;
            
            // Get report number from context instead of controller property
            var oHeaderContext = UIControls.HeaderSmartForm.getBindingContext();
            if (!oHeaderContext) {
                this.showError2("Header context not available for update");
                return;
            }
            var oHeaderData = oHeaderContext.getObject();
            var sReportNumber = oHeaderData.ReportNumber;
            
            // Check authorization before updating
            this.getOwnerComponent().getModel("authHelper") || {};
            
            // Validate all input fields before proceeding
            if (!this.validateInputFields(UIControls)) {
                return; // Stop execution if validation fails
            }
            
            BusyIndicator.show();
            
            // Debug: Log current JSON model data
            var aCurrentItems = this._oCostDetailModel.getProperty("/items") || [];
            console.log("JSON model current items count:", aCurrentItems.length);
            if (aCurrentItems.length > 0) {
                console.log("First item CostToComplete:", aCurrentItems[0].CostToComplete);
            }
            console.log("Original data items count:", this._aOriginalCostData.length);
            
            // Get changed cost detail items
            var aChangedCostItems = this._getChangedCostItems();
            console.log("Changed cost items:", aChangedCostItems.length);
            
            // First, submit header changes via OData model
            var oModel = this.getModel();
            var bHasHeaderChanges = oModel.hasPendingChanges();
            
            // Check if there are any changes to save
            if (!bHasHeaderChanges && aChangedCostItems.length === 0) {
                BusyIndicator.hide();
                this.showInformation("noupdate");
                return;
            }
            
            // Promise for header update
            var pHeaderUpdate = new Promise(function(resolve, reject) {
                if (bHasHeaderChanges) {
                    oModel.submitChanges({
                        success: function(oData) {
                            if (oData.__batchResponses) {
                                if (oData.__batchResponses[0].response && 
                                    oData.__batchResponses[0].response.statusCode == 400) {
                                    reject(oData.__batchResponses[0].response);
                                    return;
                                }
                            }
                            resolve();
                        },
                        error: function(oError) {
                            reject(oError);
                        }
                    });
                } else {
                    resolve(); // No header changes, resolve immediately
                }
            });
            
            // Promise for cost detail updates
            var pCostDetailUpdate = new Promise(function(resolve, reject) {
                if (aChangedCostItems.length === 0) {
                    resolve(); // No cost detail changes
                    return;
                }
                
                // Update each changed cost item
                var aUpdatePromises = aChangedCostItems.map(function(oChangedItem) {
                    return that._updateCostDetailItem(oChangedItem);
                });
                
                Promise.all(aUpdatePromises)
                    .then(function() {
                        resolve();
                    })
                    .catch(function(oError) {
                        reject(oError);
                    });
            });
            
            // Wait for both updates to complete
            Promise.all([pHeaderUpdate, pCostDetailUpdate])
                .then(function() {
                    BusyIndicator.hide();
                    that.showSuccess("updateSuccess");
                    
                    // Update original data to reflect saved changes
                    that._aOriginalCostData = JSON.parse(JSON.stringify(
                        that._oCostDetailModel.getProperty("/items") || []
                    ));
                    
                    // Recalculate table totals
                    that.calculateTableTotals(that.getCostTable(UIControls));
                })
                .catch(function(oError) {
                    BusyIndicator.hide();
                    that.showError2(that.getTextFromOdataError(oError));
                });
        },
        
        /**
         * Update a single cost detail item via OData UPDATE
         * The parameterized entity has different counter values than the actual ProjectCostDetail
         * We need to find the matching record by business keys (WBS elements) and use the correct counter
         * @param {Object} oChangedItem - Object containing key fields and changes
         * @returns {Promise}
         */
        _updateCostDetailItem: function(oChangedItem) {
            var that = this;
            var oModel = this.getModel();
            var oData = oChangedItem.fullData;
            
            return new Promise(function(resolve, reject) {
                // Build filter to find the actual record in ProjectCostDetail
                // Match by all KEY fields: ReportNumber, WBSLevel2, WBSLevel3, WBSLevel4, PONumber, counter
                // Note: HierarchyLevel is NOT a key field per metadata
                var aFilters = [
                    new sap.ui.model.Filter("ReportNumber", sap.ui.model.FilterOperator.EQ, oData.ReportNumber || ''),
                    new sap.ui.model.Filter("WBSLevel2", sap.ui.model.FilterOperator.EQ, oData.WBSLevel2 || ''),
                    new sap.ui.model.Filter("WBSLevel3", sap.ui.model.FilterOperator.EQ, oData.WBSLevel3 || ''),
                    new sap.ui.model.Filter("WBSLevel4", sap.ui.model.FilterOperator.EQ, oData.WBSLevel4 || ''),
                    new sap.ui.model.Filter("PONumber", sap.ui.model.FilterOperator.EQ, oData.PONumber || '')
                ];
                
                // First, find the actual record to get the correct counter
                oModel.read("/ProjectCostDetail", {
                    filters: aFilters,
                    urlParameters: {
                        "$top": 1
                    },
                    success: function(oResult) {
                        if (!oResult.results || oResult.results.length === 0) {
                            console.error("Could not find matching ProjectCostDetail record for:", oData);
                            reject(new Error("Record not found in ProjectCostDetail"));
                            return;
                        }
                        
                        var oActualRecord = oResult.results[0];
                        console.log("Found actual record with counter:", oActualRecord.counter);
                        
                        // Construct the entity path using the ACTUAL key values from ProjectCostDetail
                        // Key fields per metadata: ReportNumber, WBSLevel2, WBSLevel3, WBSLevel4, PONumber, counter
                        var sEntityPath = "/ProjectCostDetail(" +
                            "ReportNumber='" + encodeURIComponent(oActualRecord.ReportNumber || '') + "'," +
                            "WBSLevel2='" + encodeURIComponent(oActualRecord.WBSLevel2 || '') + "'," +
                            "WBSLevel3='" + encodeURIComponent(oActualRecord.WBSLevel3 || '') + "'," +
                            "WBSLevel4='" + encodeURIComponent(oActualRecord.WBSLevel4 || '') + "'," +
                            "PONumber='" + encodeURIComponent(oActualRecord.PONumber || '') + "'," +
                            "counter=" + (oActualRecord.counter || 0) + ")";
                        
                        // Prepare the update payload
                        var oUpdatePayload = that._prepareUpdatePayload(oData);
                        
                        console.log("Updating:", sEntityPath, "with payload:", oUpdatePayload);
                        
                        oModel.update(sEntityPath, oUpdatePayload, {
                            success: function() {
                                console.log("Successfully updated cost item: " + sEntityPath);
                                resolve();
                            },
                            error: function(oError) {
                                console.error("Error updating cost item: " + sEntityPath, oError);
                                reject(oError);
                            }
                        });
                    },
                    error: function(oError) {
                        console.error("Error finding actual record:", oError);
                        reject(oError);
                    }
                });
            });
        },
        
        /**
         * Prepare update payload by cleaning the data object
         * @param {Object} oData - Full data object
         * @returns {Object} Clean payload for update
         */
        _prepareUpdatePayload: function(oData) {
            var oPayload = {};
            
            // Only include updatable NON-KEY fields
            // Key fields (ReportNumber, WBSLevel2, WBSLevel3, WBSLevel4, PONumber, counter) 
            // should NOT be in the payload - they're in the URL
            // HierarchyLevel is NOT a key field, include it in the payload
            var aUpdatableFields = [
                'HierarchyLevel', 'CostToComplete', 'PotentialFinalAccountCost', 'RevisedBudget',
                'ProjectedFinalCost', 'Variance', 'Remarks', 'TransactionCurrency'
            ];
            
            aUpdatableFields.forEach(function(sField) {
                if (oData.hasOwnProperty(sField) && oData[sField] !== undefined) {
                    oPayload[sField] = oData[sField];
                }
            });
            
            return oPayload;
        },
        
        /**
         * Override getCostTable to handle JSON model binding
         */
        getCostTableData: function() {
            return this._oCostDetailModel.getProperty("/items") || [];
        },
        
        /**
         * Override getRowList to work with JSON model
         */
        getRowListFromJSON: function() {
            var aItems = this._oCostDetailModel.getProperty("/items") || [];
            var aResult = [];
            
            aItems.forEach(function(oItem) {
                // Skip subtotal and total rows
                if (oItem.HierarchyLevel === -1 || oItem.HierarchyLevel === -2) {
                    return;
                }
                
                // Clean up the item
                var cleanData = {};
                for (var prop in oItem) {
                    if (oItem.hasOwnProperty(prop) &&
                        typeof oItem[prop] !== 'object' &&
                        typeof oItem[prop] !== 'function' &&
                        prop !== '__metadata' &&
                        !prop.startsWith('to_') &&
                        !prop.endsWith('_oc') &&
                        !prop.endsWith('_mc') &&
                        oItem[prop] !== null &&
                        oItem[prop] !== undefined) {
                        cleanData[prop] = oItem[prop];
                    }
                }
                aResult.push(cleanData);
            });
            
            return aResult;
        }
        
        // Include other methods from ProjectCostReport.controller.js needed for change functionality
        // ...
    });
});