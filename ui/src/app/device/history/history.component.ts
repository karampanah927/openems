import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';
import * as d3 from 'd3';
import * as d3shape from 'd3-shape';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { IMyDate, IMyDateRange, IMyDrpOptions, IMyDateRangeModel } from 'mydaterangepicker';

import { Device } from '../../shared/device/device';
import { ConfigImpl } from '../../shared/device/config';
import { DefaultTypes } from '../../shared/service/defaulttypes';
import { Websocket } from '../../shared/service/websocket';

type PeriodString = "today" | "yesterday" | "lastWeek" | "lastMonth" | "lastYear" | "otherTimespan";

@Component({
  selector: 'history',
  templateUrl: './history.component.html'
})
export class HistoryComponent implements OnInit, OnDestroy {

  private readonly TODAY = moment();
  private readonly YESTERDAY = moment().subtract(1, "days");
  private readonly TOMORROW = moment().add(1, "days");

  public device: Device = null;
  public config: ConfigImpl = null;
  public socChannels: DefaultTypes.ChannelAddresses = {};
  public powerChannels: DefaultTypes.ChannelAddresses = {};
  private dateRange: IMyDateRange;
  public fromDate = this.TODAY;
  public toDate = this.TODAY;
  public activePeriodText: string = "";
  public showOtherTimespan = false;
  private dateRangePickerOptions: IMyDrpOptions = {
    showClearBtn: false,
    showApplyBtn: false,
    dateFormat: 'dd.mm.yyyy',
    disableUntil: { day: 1, month: 1, year: 2013 }, // TODO start with date since the device is available
    disableSince: this.momentToIMyDate(this.TOMORROW),
    showWeekNumbers: true,
    showClearDateRangeBtn: false,
    editableDateRangeField: false,
    openSelectorOnInputClick: true
  };

  private stopOnDestroy: Subject<void> = new Subject<void>();
  private activePeriod: PeriodString = "today";

  constructor(
    public websocket: Websocket,
    private route: ActivatedRoute,
    private translate: TranslateService
  ) { }

  ngOnInit() {
    this.websocket.setCurrentDevice(this.route)
      .takeUntil(this.stopOnDestroy)
      .subscribe(device => {
        this.device = device;
        if (device == null) {
          this.config = null;
        } else {
          device.config
            .takeUntil(this.stopOnDestroy)
            .subscribe(config => {
              this.config = config;
              if (config) {
                this.socChannels = config.getEssSocChannels();
                this.powerChannels = config.getPowerChannels();
              } else {
                this.socChannels = {};
                this.powerChannels = {};
              }
            });
        }
      });
    this.setPeriod("today");
  }

  onDateRangeChanged(event: IMyDateRangeModel) {
    let fromDate: moment.Moment = moment(event.beginJsDate);
    let toDate: moment.Moment = moment(event.endJsDate);
    if (fromDate.isSame(toDate, "day")) {
      // only one day selected
      if (this.TODAY.isSame(fromDate, "day")) {
        this.setPeriod("today");
        return;
      } else if (this.YESTERDAY.isSame(fromDate, "day")) {
        this.setPeriod("yesterday");
        return;
      }
    }
    this.setPeriod("otherTimespan", fromDate, toDate);
  }

  /**
   * This is called by the input button on the UI.
   * @param period
   * @param from
   * @param to
   */
  private setPeriod(period: PeriodString, from?: any, to?: any) {
    this.activePeriod = period;
    if (period != "otherTimespan") {
      this.showOtherTimespan = false;
    }
    switch (period) {
      case "yesterday": {
        let yesterday = moment().subtract(1, "days");
        this.setDateRange(yesterday, yesterday);
        this.activePeriodText = this.translate.instant('Device.History.Yesterday') + ", " + yesterday.format(this.translate.instant('General.DateFormat'));
        break;
      }
      case "lastWeek": {
        let oneWeekAgo = moment().subtract(1, "weeks");
        let today = moment();
        this.setDateRange(oneWeekAgo, today);
        this.activePeriodText = this.translate.instant('Device.History.LastWeek') + ", " + this.translate.instant('General.PeriodFromTo', { value1: oneWeekAgo.format(this.translate.instant('General.DateFormat')), value2: today.format(this.translate.instant('General.DateFormat')) });
        break;
      }
      case "lastMonth": {
        let oneMonthAgo = moment().subtract(1, "months");
        let today = moment();
        this.setDateRange(oneMonthAgo, today);
        this.activePeriodText = this.translate.instant('Device.History.LastMonth') + ", " + this.translate.instant('General.PeriodFromTo', { value1: oneMonthAgo.format(this.translate.instant('General.DateFormat')), value2: today.format(this.translate.instant('General.DateFormat')) });
        break;
      }
      case "lastYear": {
        let oneYearAgo = moment().subtract(1, "years");
        let today = moment();
        this.setDateRange(oneYearAgo, today);
        this.activePeriodText = this.translate.instant('Device.History.LastYear') + ", " + this.translate.instant('General.PeriodFromTo', { value1: oneYearAgo.format(this.translate.instant('General.DateFormat')), value2: today.format(this.translate.instant('General.DateFormat')) });
        break;
      }
      case "otherTimespan":
        let fromDate = moment(from);
        let toDate = moment(to);
        if (fromDate > toDate) {
          toDate = fromDate;
        }
        this.setDateRange(fromDate, toDate);
        this.activePeriodText = this.translate.instant('Device.History.Period') + ", " + this.translate.instant('General.PeriodFromTo', { value1: fromDate.format(this.translate.instant('General.DateFormat')), value2: toDate.format(this.translate.instant('General.DateFormat')) });
        break;
      case "today":
      default:
        let today = moment();
        this.setDateRange(today, today);
        this.activePeriodText = this.translate.instant('Device.History.Today') + ", " + today.format(this.translate.instant('General.DateFormat'));
        break;
    }
  }

  private setDateRange(fromDate: moment.Moment, toDate: moment.Moment) {
    this.fromDate = fromDate;
    this.toDate = toDate;
    this.dateRange = {
      beginDate: this.momentToIMyDate(fromDate),
      endDate: this.momentToIMyDate(toDate)
    }
  }

  private momentToIMyDate(date: moment.Moment): IMyDate {
    return { year: date.year(), month: date.month() + 1, day: date.date() }
  }

  // start with loading "today"
  // if (this.activePeriod == null) {
  //   this.setPeriod("today");
  // }
  // device.historykWh.subscribe((newkWh) => {
  //   if (newkWh != null) {
  //     let kWhGridBuy = {
  //       name: "",
  //       value: 0
  //     }
  //     let kWhGridSell = {
  //       name: "",
  //       value: 0
  //     }
  //     let kWhProduction = {
  //       name: "Erzeugung",
  //       value: 0
  //     }
  //     let kWhStorageCharge = {
  //       name: "",
  //       value: 0
  //     }
  //     let kWhStorageDischarge = {
  //       name: "",
  //       value: 0
  //     }
  //     for (let type in newkWh) {
  //       if (newkWh[type].type == "production") {
  //         let production = newkWh[type].value != null ? newkWh[type].value : 0;
  //         kWhProduction.value = Math.round(production);
  //       } else if (newkWh[type].type == "grid") {
  //         let gridBuy = newkWh[type].buy != null ? newkWh[type].buy : 0;
  //         kWhGridBuy.name = "Netzbezug";
  //         kWhGridBuy.value = Math.round(gridBuy);
  //         let gridSell = newkWh[type].sell != null ? newkWh[type].sell : 0;
  //         kWhGridSell.name = "Netzeinspeiung";
  //         kWhGridSell.value = Math.round((gridSell * (-1)));
  //       } else {
  //         let storageCharge = newkWh[type].charge != null ? newkWh[type].charge : 0;
  //         kWhStorageCharge.name = "Batteriebeladung";
  //         kWhStorageCharge.value = Math.round((storageCharge * (-1)));
  //         let storageDischarge = newkWh[type].discharge != null ? newkWh[type].discharge : 0;
  //         kWhStorageDischarge.name = "Batterieentladung";
  //         kWhStorageDischarge.value = Math.round(storageDischarge);
  //       }
  //     }
  //     this.datakWh = [kWhProduction, kWhGridBuy, kWhGridSell, kWhStorageCharge, kWhStorageDischarge];
  //   }
  // })
  // device.historyData.subscribe((newData) => {
  //   if (newData != null) {
  //     let dataSoc = {
  //       name: "Ladezustand",
  //       series: []
  //     }
  //     let dataEnergy = {
  //       name: "Erzeugung",
  //       series: []
  //     }
  //     let dataConsumption = {
  //       name: "Verbrauch",
  //       series: []
  //     }
  //     let dataToGrid = {
  //       name: "Netzeinspeisung",
  //       series: []
  //     }
  //     let dataFromGrid = {
  //       name: "Netzbezug",
  //       series: []
  //     }
  //     for (let newDatum of newData) {
  //       let timestamp = moment(newDatum["time"]);
  //       let soc = newDatum.summary.storage.soc != null ? newDatum.summary.storage.soc : 0;
  //       dataSoc.series.push({ name: timestamp, value: soc });
  //       let production = newDatum.summary.production.activePower != null ? newDatum.summary.production.activePower : 0;
  //       dataEnergy.series.push({ name: timestamp, value: production });
  //       let consumption = newDatum.summary.consumption.activePower != null ? newDatum.summary.consumption.activePower : 0;
  //       dataConsumption.series.push({ name: timestamp, value: consumption });
  //       let grid = newDatum.summary.grid.activePower != null ? newDatum.summary.grid.activePower : 0;
  //       if (newDatum.summary.grid.activePower < 0) {
  //         dataToGrid.series.push({ name: timestamp, value: (grid * (-1)) });
  //       } else {
  //         dataFromGrid.series.push({ name: timestamp, value: grid });
  //       }
  //     }
  //     this.dataSoc = [dataSoc];
  //     this.dataEnergy = [dataEnergy, dataConsumption, dataToGrid, dataFromGrid];
  //   }
  // })

  /**
   * later: needed data for energychart.component.ts
   * current: storage ActivePower is shown on energychart.component.ts
   */
  // private dataEnergy = [
  //   {
  //     "name": "Eigene PV-Produktion",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 47.0 }, { name: "2017-03-21T15:22", value: 47.0 }, { name: "2017-03-21T15:23", value: 63.0 }
  //     ]
  //   },
  //   {
  //     "name": "Durchschnittliche PV-Produktion",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 25.0 }, { name: "2017-03-21T15:22", value: 35.0 }, { name: "2017-03-21T15:23", value: 30.0 }
  //     ]
  //   },
  //   {
  //     "name": "Eigener Verbrauch",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 50.0 }, { name: "2017-03-21T15:22", value: 70.0 }, { name: "2017-03-21T15:23", value: 60.0 }
  //     ]
  //   },
  //   {
  //     "name": "Durchschnittlicher Verbrauch",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 12.0 }, { name: "2017-03-21T15:22", value: 15.0 }, { name: "2017-03-21T15:23", value: 17.0 }
  //     ]
  //   },
  //   {
  //     "name": "Eigene Netzeinspeisung",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 15.0 }, { name: "2017-03-21T15:22", value: 20.0 }, { name: "2017-03-21T15:23", value: 25.0 }
  //     ]
  //   },
  //   {
  //     "name": "Durchschnittliche Netzeinspeisung",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 17.0 }, { name: "2017-03-21T15:22", value: 21.0 }, { name: "2017-03-21T15:23", value: 23.0 }
  //     ]
  //   },
  //   {
  //     "name": "Eigener Netzbezug",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 5.0 }, { name: "2017-03-21T15:22", value: 10.0 }, { name: "2017-03-21T15:23", value: 15.0 }
  //     ]
  //   },
  //   {
  //     "name": "Durchschnittlicher Netzbezug",
  //     "series": [
  //       { name: "2017-03-21T15:21", value: 7.0 }, { name: "2017-03-21T15:22", value: 10.0 }, { name: "2017-03-21T15:23", value: 12.0 }
  //     ]
  //   }
  // ];



  // private setTimespan(from: any, to: any) {
  //   if (from != "" || to != "") {
  //     this.setPeriod('otherTimespan', from, to);
  //   }
  // }

  ngOnDestroy() {
    this.stopOnDestroy.next();
    this.stopOnDestroy.complete();
  }


}