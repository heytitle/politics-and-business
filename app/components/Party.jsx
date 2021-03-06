import React from 'react';
import rd3 from 'react-d3-library';
import { Redirect, Link } from 'react-router-dom';
import d3Viz from 'd3Party';
import _ from 'lodash';

import ReactDOM from 'react-dom';
import Legend from './Legend';
import PoliticianCard from './PoliticianCard';
import SearchBox from './SearchBox';
import Select from 'react-select';
import { config, isSmallScreen, projectNumbering, moneyFormat } from '../utils';

import './shared/typography.css'
import * as partyStyle from './party.css'

import * as utils from '../utils';
import randomInt from 'random-int';

const RD3Component = rd3.Component;

class Party extends React.Component {

  constructor(props) {
    super(props);
    this.state = { d3: '', newPath: null, params: props.params, searchValue: '' }

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.randomPolitician = this.randomPolitician.bind(this);
    this.randomOrg = this.randomOrg.bind(this);
  }

  componentDidMount() {
    this.renderParty(this.props.params.partyName);
    document.addEventListener("keydown", this.handleKeyDown, false);
  }

  componentWillUnmount() {
    this.state.d3HighlightForEvent(null);
    document.removeEventListener("keydown", this.handleKeyDown, false);
  }

  handleKeyDown(e) {
    if (e.key === 'p') {
      this.randomPolitician();
    } else if (e.key === 'o') {
      this.randomOrg();
    } else if (e.key === 'Escape') {
      this.props.history.push(`/p/${this.props.params.partyName}`)
    }
  }

  randomPolitician(){
      const dataPols = this.state.dataPolsWithBusiness
      const p = dataPols[randomInt(dataPols.length)]
      this.props.history.push(`/p/${this.props.params.partyName}/person/${p.name}`)
  }

  randomOrg(){
      const orgs = this.state.dataOrgs;
      const o = orgs[randomInt(orgs.length)]
      this.props.history.push(`/p/${this.props.params.partyName}/org/${o._id}`)
  }

  renderParty(partyName) {
    const self = this;

    fetch(`//${process.env.publicPath}/assets/data/${partyName}.json`)
      .then(response => response.json())
      .then(data => {
        const politicians = data.map(p => {
          p['EventID'] = [p['name']]
          p['Count'] = 1
          p['Type'] = 'politician'
          return p
        })

        let orgsBeforeDeDup = data.map(p => {
            return p.relatedTo.map(o => {
              const cpm = parseFloat(o['cpm'].replace(/,/g, ''))
              o['EventID'] = p['name']
              o['Count'] = utils.discretizeCPM(cpm)
              o['Type'] = 'org'
              o['cpm'] = cpm 

              if(o['totalProjects']){
                o['colorScale'] = o['totalPriceBuild']
              } else {
                o['colorScale'] = 0
              }

              return o;
            });
          })
          .flat()

        const orgs = _(orgsBeforeDeDup)
            .groupBy('_id')
            .map( (v, k) => {
              const v0 = v[0];
              v0['EventID'] = _.map(v, 'EventID');
              return v0;
            })
            .value()

        console.log('total nodes', orgs.length + politicians.length);
        let orgsForD3 =  orgs
        const nodeCount = politicians.length + orgs.length
        if (nodeCount < config.d3.totalBubbles) {
          let cummy = [...Array(config.d3.totalBubbles - nodeCount)]
            .map( (a) => {
              return {Count: 3, EventID: null, Type: 'org'}
            })
          orgsForD3 = orgs.concat(cummy)
        }

        const d3Data = {
          'name': partyName,
          'maxRelatedTo': Math.max(...politicians.map(p => p.relatedTo.length)),
          'maxMoney': Math.max(...orgs.map(o => o.colorScale)),
          'children': [{
            Count: 50,
            Type: 'logo'
          }]
            .concat(politicians)
            .concat(orgsForD3)
        }

        const topPoliticians = politicians.filter(a => a.relatedTo.length > 0)
          .sort((a, b) => b.relatedTo.length - a.relatedTo.length)
          .slice(0, 5)

        const dd = d3Viz(d3Data, this.props)
        self.setState({
          partyName: partyName,
          dataPols: politicians,
          dataPolsWithBusiness: politicians.filter(p => p.relatedTo.length > 0),
          dataOrgs: orgs,
          d3Data: d3Data,
          d3Obj: dd.containerNode,
          d3HighlightForEvent: dd.highlightForEvent,
          totalCPM: orgs.map(o => o.cpm)
            .reduce((a, b) => a + b, 0),
          totalPoliticians: politicians.length,
          totalPoliticiansInvoledWithBusiness: politicians.filter(p => p.relatedTo.length > 0).length,
          topList: topPoliticians
        })
      })
  }

  render() {
    if (this.state.newPath) {
      return <Redirect to={'/r/p-' + this.state.newPath} />
    }

    let selectedObject = null;
    if (this.state.dataPols && this.state.dataOrgs) {
      if (this.props.params.personName) {
        selectedObject = this.state.dataPols.find(p => p.name === this.props.params.personName)
      } else if (this.props.params.orgID) {
        selectedObject = this.state.dataOrgs.find(o => o._id == this.props.params.orgID)
      }

      if (selectedObject) {
        const bbBox = ReactDOM.findDOMNode(this.d3Dom)
          .getBoundingClientRect();
        this.state.d3HighlightForEvent(selectedObject.EventID, bbBox, selectedObject.JP_TNAME);
      } else {
        this.state.d3HighlightForEvent(null);
      }
    }

    const searchBox = this.state.isSearchingNewParty ?
        <Select
          autoFocus={this.state.isSearchingNewParty}
          defaultMenuIsOpen={this.state.isSearchingNewParty}
          options={config.availableParties}
          placeholder="เลือกพรรค"
          onChange={(opt) => this.props.history.push(`/r/p-${opt.value}`)}
          onBlur={() => this.setState({isSearchingNewParty: false})}
        />
        :
        <SearchBox politicians={_.orderBy(this.state.dataPols, ['name'])} history={this.props.history} partyName={this.props.params.partyName}/>

    return (
      <div className={partyStyle.party}>
        <div className={partyStyle.descBox}>
          <div>
            <h2>
              ประวัติเกี่ยวข้องกับธุรกิจของผู้สมัคร ส.ส. พรรค
            </h2>
            <h1 className={partyStyle.title} onClick={() => this.setState({isSearchingNewParty: true})}>
              <span>{this.props.params.partyName}</span>
              { !this.state.isSearchingNewParty && 
                <span  className={partyStyle.titleDropdownButton}>⌃</span>
              }
            </h1>

          <div className={partyStyle.toolBarContainer}>
            {searchBox}

            { !selectedObject &&
              <div className={partyStyle.legendSection}>
                <div>
                  <b>หรือ</b>
                  <span className={partyStyle.button} onClick={this.randomPolitician} title="Hotkey (p)">สุ่มเลือก</span>
                  จาก ผู้สมัคร ส.ส. ในพรรคเดียวกัน
                </div>
                <div className={partyStyle.buttonContainer}>
                </div>
              </div>
            }
          </div>
          </div>

          {!this.props.params.personName &&
            !this.props.params.orgID &&
            this.state.d3Data &&
            <div>
              <div className={partyStyle.description}>
                <div className={partyStyle.descDetails}>
                  { this.state.topList.length > 0 && <span>
                      ผู้สมัคร ส.ส.​ จำนวน <b>{this.state.totalPoliticiansInvoledWithBusiness}</b> จาก <b>{this.state.totalPoliticians}</b> คน
                      ของ พรรค{this.props.params.partyName} เป็นหรือเคยเป็นกรรมการนิติบุคคล
                      ซึ่งมีทุนจดทะเบียนรวมทั้งสิ้น <b>{moneyFormat(this.state.totalCPM)}</b> โดย ผู้สมัครฯ ที่เกี่ยวข้องกับธุรกิจมากที่สุด คือ
                      {this.state.topList && <ul className={partyStyle.topListUL}>
                        {
                          this.state.topList.map((p, idx) => {
                            return <li>
                              <div>
                                {idx + 1}. <Link to={`/p/${this.props.params.partyName}/person/${p.name}`}>{p.name}</Link> ({p.relatedTo.length} นิติบุคคล)
                              </div>
                            </li>
                          })
                        }
                      </ul>
                      }
                    </span>
                  } 
                  {
                    this.state.topList.length == 0 && <span>
                      ผู้สมัคร ส.ส. ทั้ง {this.state.dataPols.length} ไม่มีประวัติเกี่ยวข้องกับธุรกิจ
                      </span>
                  }
                </div>
              </div>
            </div>
          }
          {this.props.params.personName && selectedObject &&
            <PoliticianCard politician={selectedObject} partyName={this.props.params.partyName}/>
          }
          {this.props.params.orgID && selectedObject &&
            <div className={partyStyle.orgContainer}>
              <h2 className={partyStyle.orgHeader}>{selectedObject.JP_TNAME}</h2>
              <h4 className={partyStyle.orgSubHeader}>เกี่ยวข้องกับ {
                
                selectedObject.EventID.map(e => {
                  return (<Link key={e} to={`/p/${this.props.params.partyName}/person/${e}`}>{e}</Link>)
                }).reduce((prev, curr) => [prev, ', ', curr])
              }</h4>

              <div>ประเภท: <b>{selectedObject.jptn}</b></div>

              <div className={partyStyle.orgDetails}>
                มีวัตถุประสงค์เพื่อ <b>{selectedObject.OBJ_TNAME}</b> จดทะเบียนด้วยทุน <b>{moneyFormat(selectedObject.cpm)} </b>
                ด้วยเลขที่นิติบุคคล <b>{this.props.params.orgID}</b> สถานะปัจจุบันคือ <b>{selectedObject.stn}</b>

                { selectedObject.totalProjects && <div>
                  เคยเกี่ยวข้องกับโครงการจัดซื้อจัดจ้างของภาครัฐ ทั้งหมด <b>{projectNumbering.total(selectedObject.totalProjects)}</b> โครงการ
                  ซึ่งรวมงบประมาณแล้วทั้งสิ้น <b>{projectNumbering.amount(selectedObject.totalProjects, selectedObject.totalPriceBuild) }</b>
                </div>
                }
              </div>

              <div className={partyStyle.orgFooter}>
                <div className="FooterLink">
                  <a href={`https://govspending.data.go.th/budget?winner=${this.props.params.orgID}`} target="_blank">ค้นหาเพิ่มเติมใน เว็บภาษีไปไหน</a>
                </div>
                <div className="FooterLink">
                  <a href={config.url.credenBusinessPage.replace(/<ID>/, selectedObject._id)} target="_blank">ค้นหาเพิ่มเติมใน Creden.co</a>
                </div>
                <Link className="FooterLink" to={`/p/${this.props.params.partyName}`} title="Hotkey (ESC)">ปิดหน้าต่างนี้</Link>
              </div>
            </div>
          }
        </div>

        <div className={partyStyle.d3Container}>
          <RD3Component data={this.state.d3Obj} ref={(dom) => { this.d3Dom = dom }} />
        </div>
        <Legend/>
        <div className={partyStyle.clear}></div>
      </div>
    )
  }
}

export default Party