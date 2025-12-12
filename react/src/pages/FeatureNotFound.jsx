import './FeatureNotFound.css';

const FeatureNotFound = ({ reason }) => {
    return (
        <div className="notfound">
        <p>Feature disabled: {reason || "Whoops. It seems that this page is unavailable."}</p>
        </div>
  );
};

export default FeatureNotFound;