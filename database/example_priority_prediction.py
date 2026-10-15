# Example: baseline priority prediction
# Install scikit-learn and pandas in your own environment if needed.
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

df = pd.read_csv("issues.csv")
X = df[["title", "description", "issue_type", "severity", "business_impact", "component", "environment"]].fillna("")
X["text"] = X["title"] + " " + X["description"]
y = df["priority"]
features = ColumnTransformer([
    ("text", TfidfVectorizer(ngram_range=(1, 2), max_features=12000), "text"),
    ("categorical", OneHotEncoder(handle_unknown="ignore"), ["issue_type", "severity", "business_impact", "component", "environment"]),
], remainder="drop")
model = Pipeline([("features", features), ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced"))])
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=.25, random_state=42, stratify=y)
model.fit(X_train, y_train)
print(classification_report(y_test, model.predict(X_test), zero_division=0))
# This synthetic target is partly rule-generated; scores are not evidence of production performance.
