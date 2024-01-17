import Title from "./components/Title";


export default function Home() {
  return (
    <main className="">
      <section id="presentation-section" className="first-section">
        <div className="basis-1/3 justify-self-start">
          <Title />
        </div>

        <div className="basis-2/3 ms-8">
          <h2 className="subtitle-text title-color mb-4">About</h2>
          <p className="mb-4">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam malesuada arcu ex, vitae gravida felis vestibulum ut.
            Morbi congue, est ut dictum dignissim, lacus nibh laoreet est, in molestie metus massa eget nisi. In finibus eu massa vitae mattis.
            Quisque iaculis eros vitae diam consectetur accumsan. Mauris efficitur magna tellus. Etiam sagittis mi nec varius congue.
            Mauris nibh metus, ultrices ac ante id, vestibulum luctus velit. Morbi at metus tortor. Morbi in nisl lorem. Sed mattis feugiat ultrices.
            Pellentesque quis maximus sem. Quisque gravida efficitur lorem, a commodo massa imperdiet vel.
          </p>

          <p className="mb-4">
            Curabitur ut odio eget magna laoreet eleifend a eget justo. Etiam et venenatis nulla. Proin vestibulum luctus arcu, vitae tincidunt quam fringilla nec.
            Duis faucibus, mi non scelerisque mattis, nunc orci pretium sapien, sit amet porttitor est tellus vel leo. Suspendisse tempor finibus urna.
            Nunc vitae erat a ligula dictum condimentum at at lacus. Morbi a odio sed mi vehicula ornare in scelerisque tortor.
            Phasellus ut mauris vitae felis dictum cursus sed nec metus. Curabitur iaculis dignissim tellus, non consequat justo maximus et.
          </p>

          <p>
            Praesent vitae egestas nisl. Suspendisse vitae arcu ac ex volutpat dictum. Pellentesque fringilla sapien massa, non euismod sem cursus id.
            Nullam posuere, nisl sit amet rutrum aliquet, sem justo lacinia odio, id sollicitudin sem lacus in orci.
            Ut turpis urna, elementum sit amet convallis volutpat, dignissim eget magna. Praesent a tempus leo. Interdum et malesuada fames ac ante ipsum primis in faucibus.
            Integer porttitor purus id nunc porta, eu pellentesque ipsum luctus. Donec a luctus ipsum. Ut dictum dolor eu condimentum ornare. Maecenas dictum feugiat mattis.
            Maecenas mollis at dolor volutpat tincidunt. Morbi vehicula metus non ipsum tempor, quis venenatis libero iaculis. Nulla facilisi.
          </p>
        </div>
      </section>
      {/* <section id="statistical-section" className="h-svh">
        placeholder for statistical info retrieved from DApp
      </section> */}
    </main>
  )
}
