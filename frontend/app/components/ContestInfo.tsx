"use client"



import { Tab } from '@headlessui/react'
import { RuleInfo } from '../backend-libs/core/ifaces'

function ContestInfo({contest}:{contest:RuleInfo}) {


    return (
        <Tab.Group vertical>
            <div className='flex items-start space-x-4 w-full'>
                <Tab.List className="vertical-option-tabs-header">
                    <Tab
                        className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                        >
                            <span className='game-tabs-option-text'>
                                <span>Overview</span>
                            </span>
                    </Tab>

                    <Tab
                        className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                        >
                            <span className='game-tabs-option-text'>
                                <span>Leaderboard</span>
                            </span>
                    </Tab>
                </Tab.List>

                <Tab.Panels className="overflow-auto custom-scrollbar w-full max-h-full">
                    <Tab.Panel className="game-tab-content">
                        <span className='text-lg'>Description</span>
                        <br/>

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam vulputate malesuada arcu, in condimentum purus suscipit eu. Aliquam ac vehicula mi. Nunc tincidunt elit nec maximus rutrum. Ut at diam quam. Sed malesuada ex a nulla ullamcorper viverra. Nam imperdiet eros egestas lectus tempus volutpat. Fusce suscipit libero tortor, eget placerat ligula faucibus sed. Nunc nec cursus metus. Mauris ac dui tempus, posuere nisi ut, mollis lectus. Nunc vitae nisi vitae lectus tincidunt aliquam sed id dui. Nam tempus mauris non velit tempus, cursus varius ante laoreet. Phasellus sed lacus vestibulum, imperdiet mi sed, fermentum odio. Cras imperdiet nulla ut congue sagittis. Morbi id arcu lobortis, dictum odio sed, lobortis magna.

Ut a aliquam tortor. Etiam lacus quam, tincidunt vitae venenatis sed, fermentum et sem. Duis tristique, erat at fermentum convallis, ipsum tellus consectetur nulla, vitae bibendum urna felis at enim. Phasellus pharetra massa congue diam sollicitudin semper. Etiam tellus urna, feugiat vitae consequat vitae, imperdiet nec nunc. Morbi ut lorem nec nibh varius venenatis. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Nulla vel porttitor massa, vitae varius nunc.

Praesent elementum justo sapien, in maximus nibh faucibus id. Fusce odio sem, molestie ut massa a, placerat lobortis est. Nulla interdum vehicula augue in eleifend. Curabitur viverra eget velit ut tincidunt. Aenean vehicula tortor ipsum, ut consequat sapien molestie et. Nulla quis nunc vel elit suscipit convallis. Ut nec finibus libero, sit amet elementum enim. Aenean laoreet eget massa at iaculis. Pellentesque vitae tortor nibh. Fusce vitae efficitur ante, at eleifend turpis. Nam at neque eget arcu malesuada aliquet nec sollicitudin est. Nullam eleifend nisi viverra finibus feugiat. Ut diam nisl, venenatis sit amet eros et, fermentum egestas felis. Integer nulla nunc, fermentum ut metus eu, ultrices mattis metus. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.

Etiam fermentum nibh sed sapien interdum luctus. Ut elementum iaculis purus quis facilisis. Donec ullamcorper tortor vel lectus sodales congue. Praesent facilisis lectus eu imperdiet auctor. Proin convallis eros sapien, at feugiat augue scelerisque ut. Curabitur fringilla metus non neque faucibus ultricies. Nam odio lorem, dapibus semper nulla sed, porta lacinia magna. Ut placerat varius lacus ac fringilla. Nullam imperdiet efficitur nibh a accumsan. Integer mauris nulla, condimentum eu erat vitae, sollicitudin blandit magna.

Nunc pharetra, dui ut suscipit lobortis, massa augue posuere nisi, nec laoreet dolor massa vitae metus. Nulla sit amet gravida nisi, vel feugiat odio. Sed mi purus, molestie ac arcu a, lobortis viverra tortor. Aliquam non justo auctor nulla finibus molestie. Fusce id est malesuada, eleifend eros nec, suscipit diam. Cras sed purus pellentesque ex malesuada rhoncus. Aliquam quis ex accumsan, luctus tellus ac, tempor mi. Duis ut metus lectus. Aliquam vestibulum odio in scelerisque sodales. Proin egestas diam in massa consectetur bibendum. Vestibulum ligula sapien, egestas eu pretium sed, eleifend id enim. Aenean mollis sodales nisl, non ultrices tellus consequat sit amet. Maecenas rhoncus nunc odio, vitae dapibus eros varius mollis. Nulla facilisi. Nullam congue sapien elit, sit amet egestas elit posuere eu. 
                    </Tab.Panel>

                    <Tab.Panel className="game-tab-content">
                        Leaderboard Content
                    </Tab.Panel>

                </Tab.Panels>
            </div>

        </Tab.Group>
    )
}

export default ContestInfo