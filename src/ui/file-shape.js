export const fileShape = `{
  "questions": [
    {
      "id": "pct-01",
      "type": "mcq",
      "topic": "percentages",
      "stem": "What is 15% of 240?",
      "choices": [
        { "id": "a", "text": "30" },
        { "id": "b", "text": "36" },
        { "id": "c", "text": "40" },
        { "id": "d", "text": "45" }
      ],
      "answer": "b",
      "explanation": "0.15 × 240 = 36."
    },
    {
      "id": "pct-02",
      "type": "numeric",
      "topic": "percentages",
      "stem": "A number increased by 10% becomes 220. The number is",
      "answer": 200,
      "explanation": "x × 1.1 = 220, so x = 200."
    }
  ],
  "tests": [
    {
      "id": "percentages-20",
      "title": "Percentages — 20",
      "minutes": 20,
      "questionIds": ["pct-01", "pct-02"]
    }
  ]
}

questions and tests are arrays. At least one of them must be present.
Question ids are unique in the file. Test ids are unique in the file.
id, stem, title, and choice text are non-empty strings. Stems are plain text.
type is "mcq" or "numeric".
An MCQ has 2 to 5 choices. Choice ids are unique within that question. answer is a choice id, not the choice text.
A numeric answer is a JSON number. 200 matches 200.0. Units, fractions, and exponent notation do not match.
topic and explanation may be omitted. If present, each is a non-empty string. topic is the section name on the report.
minutes is a positive integer. questionIds lists ids with no duplicates. Each id is in this file or already in the bank.
Importing the same id again updates that question or test. Ids missing from the file stay in the bank.`;

export function renderFileShape(container) {
  const shell = document.createElement("div");
  shell.className = "shell";

  const back = document.createElement("a");
  back.className = "back-link btn-link";
  back.href = "#/";
  back.textContent = "Back to desk";

  const title = document.createElement("h1");
  title.className = "site-title";
  title.textContent = "Question file";

  const lead = document.createElement("p");
  lead.className = "empty-note";
  lead.textContent = "This is the JSON shape an import accepts. Copy it for the agent that writes your papers.";

  const specimen = document.createElement("textarea");
  specimen.className = "file-specimen";
  specimen.readOnly = true;
  specimen.value = fileShape;
  specimen.setAttribute("aria-label", "Question file shape");

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn btn-primary";
  copy.textContent = "Copy the file shape";
  copy.addEventListener("click", async () => {
    specimen.focus();
    specimen.select();
    try {
      await navigator.clipboard.writeText(fileShape);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select the shape and copy it";
    }
    setTimeout(() => {
      copy.textContent = "Copy the file shape";
    }, 1600);
  });

  shell.append(back, title, lead, specimen, copy);
  container.appendChild(shell);

  return () => {
    shell.remove();
  };
}
