import { Link } from 'react-router-dom';
import HowItWorks from './HowItWorks';
import QueryDemo from './QueryDemo';
import ScreenCards from './ScreenCards';
import WordListsSection from './WordListsSection';
import './home.css';

// The first page. Fixed text and fixed example data only: it never calls the cluster (R5.8).
export default function HomeScreen() {
  return (
    <div className="home">
      <div className="wrap">
        <div className="hero">
          <span className="float f1" aria-hidden="true">shoe</span>
          <span className="float f2" aria-hidden="true">synonym</span>
          <span className="float f3" aria-hidden="true">_score</span>
          <div>
            <p className="eyebrow">For OpenSearch</p>
            <h1>
              See <mark>why</mark> a document matched your search.
            </h1>
            <p className="lead">
              Search Lens shows how your query becomes tokens, which documents match, and how each score is built.
              Step by step, in pictures.
            </p>
            <div className="cta">
              <Link className="btn primary" to="/connect">
                Connect to a cluster
              </Link>
              <a className="btn ghost" href="#how">
                See how it works
              </a>
            </div>
          </div>
          <QueryDemo />
        </div>

        <section id="screens" aria-labelledby="screens-title">
          <h2 id="screens-title">Five screens, one job</h2>
          <p className="sub">Each screen answers one question you have when search does not behave.</p>
          <ScreenCards />
        </section>

        <WordListsSection />

        <HowItWorks />
      </div>
      <footer>
        <div className="wrap">Search Lens · explains search behaviour in OpenSearch · read-only</div>
      </footer>
    </div>
  );
}
