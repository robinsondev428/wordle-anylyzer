import { h, Component, RenderableProps, Fragment } from 'preact';
import * as styles from './styles.module.css';
import * as utilStyles from '../../../utils.module.css';
import 'add-css:./styles.module.css';
import {
  aiPlay,
  analyzeGuess,
  getGuessesColors,
  getInvalidWords,
} from './analyzer';
import {
  AIPlay,
  CellColors,
  Clue,
  GuessAnalysis,
  RemainingAnswers,
} from 'shared-types/index';
import Guess from '../../Guess';
import PreCommentary from './PreCommentary';
import AnalysisEntry from './AnalysisEntry';
import Progress from './Progress';
import Share from './Share';
import PostCommentary from './PostCommentary';

interface Props {
  guesses: string[];
  answer: string;
}

interface State {
  /** Number is 0-1 representing progress */
  analysis: (GuessAnalysis | number)[];
  /** Number is 0-1 representing progress */
  aiPlays: (AIPlay | number)[];
  guessCellColors: CellColors[] | undefined;
  analysisError: string | undefined;
}

export default class Analysis extends Component<Props, State> {
  state: Readonly<State> = {
    analysis: [],
    aiPlays: [],
    guessCellColors: undefined,
    analysisError: undefined,
  };

  constructor(props: Props) {
    super(props);
    this.#analyze();
  }

  componentDidUpdate(previousProps: Props) {
    if (
      previousProps.answer !== this.props.answer ||
      previousProps.guesses.length !== this.props.guesses.length ||
      previousProps.guesses.some((guess, i) => guess !== this.props.guesses[i])
    ) {
      this.#analyze();
    }
  }

  componentWillUnmount() {
    if (this.#abortController) this.#abortController.abort();
  }

  #abortController: AbortController | undefined = undefined;

  async #analyze() {
    if (this.#abortController) this.#abortController.abort();

    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    try {
      this.setState((state) => ({
        analysis: [],
        aiPlays: [],
        guessCellColors: undefined,
      }));

      this.setState({
        guessCellColors: await getGuessesColors(
          signal,
          this.props.answer,
          this.props.guesses,
        ),
      });

      const invalidAnswers = await getInvalidWords(signal, this.props.guesses);

      if (invalidAnswers.length !== 0) {
        this.setState({
          analysisError: `Uh oh, one or more of those words isn't in the dictionary: ${invalidAnswers
            .map((word) => `"${word}"`)
            .join(', ')}`,
        });

        return;
      }

      {
        const previousClues: Clue[] = [];
        let remainingAnswers: RemainingAnswers | undefined = undefined;

        for (const [i, guess] of this.props.guesses.entries()) {
          this.setState((state) => {
            const analysis = state.analysis.slice();
            analysis[i] = 0;
            return { analysis };
          });

          const result: GuessAnalysis = await analyzeGuess(
            signal,
            guess,
            this.props.answer,
            previousClues,
            {
              remainingAnswers,
              onProgress: (done, expecting) => {
                this.setState((state) => {
                  const analysis = state.analysis.slice();
                  analysis[i] = done / expecting;
                  return { analysis };
                });
              },
            },
          );

          this.setState((state) => {
            const analysis = state.analysis.slice();
            analysis[i] = { ...result };
            return { analysis };
          });

          previousClues.push(result.plays.user.clue);
          remainingAnswers = result.plays.user.remainingAnswers;
        }
      }

      {
        const previousClues: Clue[] = [];
        let remainingAnswers: RemainingAnswers | undefined = undefined;

        for (let guess = 0; ; guess++) {
          this.setState((state) => {
            const aiPlays = state.aiPlays.slice();
            aiPlays[guess] = 0;
            return { aiPlays };
          });

          const result: AIPlay = await aiPlay(
            signal,
            this.props.answer,
            previousClues,
            {
              remainingAnswers,
              onProgress: (done, expecting) => {
                this.setState((state) => {
                  const aiPlays = state.aiPlays.slice();
                  aiPlays[guess] = done / expecting;
                  return { aiPlays };
                });
              },
            },
          );

          this.setState((state) => {
            const aiPlays = state.aiPlays.slice();
            aiPlays[guess] = { ...result };
            return { aiPlays };
          });

          if (result.play.guess === this.props.answer) break;

          previousClues.push(result.play.clue);
          remainingAnswers = result.play.remainingAnswers;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      throw err;
    }
  }

  render(
    { guesses, answer }: RenderableProps<Props>,
    { analysis, aiPlays, guessCellColors, analysisError }: State,
  ) {
    return (
      <div>
        <div class={utilStyles.container}>
          {guessCellColors && (
            <>
              <div class={styles.guesses}>
                {guesses.map((guess, i) => (
                  <Guess value={guess} cellClues={guessCellColors[i]} />
                ))}
              </div>
              <Share
                cellColors={guessCellColors}
                foundAnswer={guesses[guesses.length - 1] === answer}
              />
            </>
          )}
          {analysisError && <p class={styles.commentary}>{analysisError}</p>}
        </div>
        {analysis.map((guessAnalysis, i, allGuessAnalysis) => (
          <>
            <h2 class={styles.pillHeading}>Guess {i + 1}</h2>
            {typeof guessAnalysis === 'number' ? (
              <div class={styles.progressContainer}>
                <Progress value={guessAnalysis} />
              </div>
            ) : (
              <>
                <div class={utilStyles.container}>
                  <div class={styles.commentary}>
                    <PreCommentary
                      guessAnalysis={guessAnalysis}
                      turn={i}
                      remainingAnswers={
                        i > 0
                          ? (allGuessAnalysis[i - 1] as GuessAnalysis).plays
                              .user.remainingAnswers
                          : undefined
                      }
                    />
                  </div>
                </div>
                <AnalysisEntry
                  guessAnalysis={guessAnalysis}
                  first={i === 0}
                  answer={answer}
                />
                <div class={utilStyles.container}>
                  <div class={styles.commentary}>
                    <PostCommentary
                      guessAnalysis={guessAnalysis}
                      turn={i}
                      beforeRemainingAnswers={
                        i > 0
                          ? (allGuessAnalysis[i - 1] as GuessAnalysis).plays
                              .user.remainingAnswers
                          : undefined
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </>
        ))}
        {aiPlays.length !== 0 && (
          <div class={utilStyles.container}>
            <h2 class={styles.pillHeading}>AI playthrough</h2>

            <div class={styles.commentary}>
              <p>
                The AI mostly tries to eliminate as many answers as possible
                with each guess, although if there's a possible answer that's
                almost as good, it'll play that.
              </p>
            </div>

            <div class={styles.guesses}>
              {aiPlays.map((aiPlay, i) =>
                typeof aiPlay === 'number' ? (
                  <div class={styles.progressContainer}>
                    <Progress value={aiPlay} />
                  </div>
                ) : (
                  <Guess
                    value={aiPlay.play.guess}
                    cellClues={aiPlay.play.colors}
                  />
                ),
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}
