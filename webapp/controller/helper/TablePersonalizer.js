sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device",
    "sap/m/TablePersoController",
    "sap/ui/table/TablePersoController",
    "sap/ui/thirdparty/jquery"
],
    function (JSONModel, Device, TablePersoControllerM, TablePersoControllerUI, jQuery) {
        "use strict";
        let HeaderItemTable = null;
        return {
            /**
             * Provides runtime information for the device the UI5 app is running on as a JSONModel.
             * @returns {sap.ui.model.json.JSONModel} The device model.
             */
            init(oTable) {

            },

            create: function (oTable) {
                // Declare the variable with var keyword
                var oTablePersoController;

                // Check the type of table and use the correct PersoController
                if (oTable.isA("sap.m.Table")) {
                    oTablePersoController = new TablePersoControllerM({
                        table: oTable,
                        persoService: {
                            getPersData: function () {
                                var oDeferred = jQuery.Deferred();
                                oDeferred.resolve({});
                                return oDeferred;
                            },
                            setPersData: function (oData) {
                                var oDeferred = jQuery.Deferred();
                                oDeferred.resolve();
                                return oDeferred;
                            },
                            deletePersData: function () {
                                var oDeferred = jQuery.Deferred();
                                oDeferred.resolve();
                                return oDeferred;
                            }
                        }
                    });
                } else if (oTable.isA("sap.ui.table.Table")) {
                    oTablePersoController = new TablePersoControllerUI({
                        table: oTable,
                        persoService: {
                            getPersData: function () {
                                var oDeferred = jQuery.Deferred();
                                oDeferred.resolve({});
                                return oDeferred;
                            },
                            setPersData: function (oData) {
                                var oDeferred = jQuery.Deferred();
                                oDeferred.resolve();
                                return oDeferred;
                            },
                            delPersData: function () { // Use delPersData for sap.ui.table.TablePersoController
                                var oDeferred = jQuery.Deferred();
                                oDeferred.resolve();
                                return oDeferred;
                            }
                        }
                    });
                    
                    // Override the openDialog method to filter out excluded columns
                    var originalOpenDialog = oTablePersoController.openDialog.bind(oTablePersoController);
                    oTablePersoController.openDialog = function() {
                        // Get table columns and filter out excluded ones
                        var aColumns = oTable.getColumns();
                        var aFilteredColumns = aColumns.filter(function(oColumn) {
                            var sColumnId = oColumn.getId();
                            // Exclude the "Total" column from personalization
                            return sColumnId.indexOf("CostItemTableTotal") === -1;
                        });
                        
                        // Temporarily hide excluded columns from the table's column collection
                        var aExcludedColumns = aColumns.filter(function(oColumn) {
                            var sColumnId = oColumn.getId();
                            return sColumnId.indexOf("CostItemTableTotal") !== -1;
                        });
                        
                        // Remove excluded columns temporarily
                        aExcludedColumns.forEach(function(oColumn) {
                            oTable.removeColumn(oColumn);
                        });
                        
                        // Open the dialog
                        originalOpenDialog();
                        
                        // Add back the excluded columns after dialog opens
                        setTimeout(function() {
                            aExcludedColumns.forEach(function(oColumn, index) {
                                // Insert back at original position (4th position for Total column)
                                oTable.insertColumn(oColumn, 3);
                            });
                        }, 100);
                    };
                } else {
                    throw new Error("Unsupported table type for personalization");
                }

                if (oTablePersoController && typeof oTablePersoController.activate === "function") {
                    oTablePersoController.activate();
                }

                return oTablePersoController;
            }
        };

    });