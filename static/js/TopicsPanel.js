const {
  CategoryColorLine,
  ReaderNavigationMenuMenuButton,
  ReaderNavigationMenuDisplaySettingsButton,
  LanguageToggleButton,
  LoadingMessage,
  TwoOrThreeBox,
}                         = require('./Misc');
const React               = require('react');
const PropTypes           = require('prop-types');
const ReactDOM            = require('react-dom');
const classNames          = require('classnames');
const Sefaria             = require('./sefaria/sefaria');
const $                   = require('./sefaria/sefariaJquery');
const TextRange           = require('./TextRange');
const Footer              = require('./Footer');
import Component          from 'react-class';


class TopicsPanel extends Component {
  componentDidMount() {
    this.loadData();
    this.state = { 
      numberToRender: 2,
    };
  }
  loadData() {
    var data = Sefaria.topicList();

    if (!data) {
      Sefaria.topicList(this.incrementNumberToRender);
    }
  }
  render() {
    var topics = Sefaria.topicList();
    var topicList = topics ? topics.map(function(item, i) {
      var classes = classNames({navButton: 1, sheetButton: 1 });
      return (<a className={classes} href={"/topics/" + item.tag} key={item.tag}>{item.tag} ({item.count})</a>);
    }.bind(this)) : null;

    var classStr = classNames({myNotesPanel: 1, systemPanel: 1, readerNavMenu: 1, noHeader: this.props.hideNavHeader });
    var navTopClasses  = classNames({readerNavTop: 1, searchOnly: 1, colorLineOnly: this.props.hideNavHeader});
    var contentClasses = classNames({content: 1, hasFooter: 1});

    return (
      <div className={classStr}>
        {this.props.hideNavHeader ? null :
          <div className={navTopClasses}>
            <CategoryColorLine category={"Other"} />
            <ReaderNavigationMenuMenuButton onClick={this.props.navHome} />
            <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
            <h2>
              <span className="int-en">Topics</span>
              <span className="int-he">Topics</span>
            </h2>
        </div>}
        <div className={contentClasses} onScroll={this.onScroll}>
          <div className="contentInner">
            {this.props.hideNavHeader ?
              <h1>
                { this.props.multiPanel ? <LanguageToggleButton toggleLanguage={this.props.toggleLanguage} /> : null }
                <span className="int-en">Topics</span>
                <span className="int-he">Topics</span>
              </h1>
              : null }
            <div className="noteList">
              { topics ?
                  (topics.length ?
                     <TwoOrThreeBox content={topicList} width={this.props.width} /> 
                    : <LoadingMessage message="There are no tags here." heMessage="" />)
                  : <LoadingMessage />
              }
            </div>

          </div>
          <footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
            <Footer />
          </footer>
        </div>
      </div>);
  }
}
TopicsPanel.propTypes = {
  interfaceLang:       PropTypes.string,
  mutliPanel:          PropTypes.bool,
  hideNavHeader:       PropTypes.bool,
  navHome:             PropTypes.func,
  toggleLanguage:      PropTypes.func,
  openDisplaySettings: PropTypes.func,
};


module.exports = TopicsPanel;
