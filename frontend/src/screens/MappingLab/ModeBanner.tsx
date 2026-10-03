// Says where the tokens come from (spec 007, R5.1). Exact mode comes in task 9.
export default function ModeBanner() {
  return (
    <p className="banner" role="note">
      <b>Close copy:</b> tokens are made in this page and can differ a little from OpenSearch. Connect to a cluster for
      exact tokens.
    </p>
  );
}
